const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const sourceobj = "f106b205b51998220fa3627b9cd986702ab5b636c892fc91c4832d192e10c11c";
const gpx = JSON.parse(fs.readFileSync("out.json"));
const olc = require(__dirname + "/open-location-code/js/src/openlocationcode.js");
const root = __dirname + "/temp";

function gensectionid(routeid, segment, idx){
    const hash = crypto.createHash("sha256").update(routeid + ":" + segment + ":" + idx.toString()).digest("hex");
    return hash;
}

function genrouteid(sourceobj){
    const hash = crypto.createHash("sha256").update(sourceobj + ":" + "gpxsplit").digest("hex");
    return hash;
}

function gencode(lat, lon){
    const str = olc.encode(lat, lon);
    const len = str.length;
    const front = str.substring(0,str.length-3);
    const back = str.substring(str.length-2,str.length-1);
    return front + back;
}

function genpages(routeid, gpx){
    let arr = gpx.gpx.trk.trkseg.trkpt;
    let sectionids = {}; // cache

    /* Pass1: Inject xtime */
    arr.forEach(e => {
        e.xtime = Date.parse(e.time);
    });

    /* Pass2: Sort the array */
    arr.sort((a,b) => a.xtime - b.xtime);

    /* Pass3: Assign section code */
    arr.forEach(p => {
        const latstr = p["@lat"];
        const lonstr = p["@lon"];
        const latnum = parseFloat(latstr);
        const lonnum = parseFloat(lonstr);
        const seg = gencode(latnum, lonnum);
        p.seg = seg;
    });

    const narr = arr.map(p => {
        const latstr = p["@lat"];
        const lonstr = p["@lon"];
        const latnum = parseFloat(latstr);
        const lonnum = parseFloat(lonstr);
        let n = {
            lat: latnum,
            lon: lonnum,
            seg: p.seg,
            xtime: p.xtime,
            time: p.time
        };
        if(p.sat){
            n.sat = parseInt(p.sat);
        }
        return n;
    });

    /* Pass4: Construct pages */
    let pages = [];
    let cur = [];
    narr.forEach(e => {
        if(cur.length == 0){
            cur = [e];
        }else if(cur[0].seg != e.seg){
            pages.push(cur);
            cur = [e];
        }else{
            cur.push(e);
            if(cur.length >= 500){
                pages.push(cur);
                cur = [];
            }
        }
    });
    if(cur != []){
        pages.push(cur);
    }

    /* Pass5: Encode pages */
    let out = pages.map(e => {
        const first = e[0];
        const basetime = first.time;
        const basetime_ms = first.xtime;
        const pts = e.map(p => {
            let n = {
                lat: p.lat,
                lon: p.lon,
                tim: p.xtime - basetime_ms
            };
            if(p.sat){
                n.sat = p.sat;
            }
            return n;
        });
        let m = {
            obj: routeid,
            time: basetime_ms,
            seg: first.seg,
            pts: pts
        };
        return m;
    });

    /* Pass6: Add prev/next entries */
    let curpage = 0;
    let curseg = false;
    out.forEach(e => {
        const hash = gensectionid(routeid, e.seg, curpage);
        curpage++;
        e.id = hash;
        if(! curseg /* first entry */){
            curseg = e;
        }else{
            curseg.next = e.id;
            e.prev = curseg.id;
            curseg = e;
        }
    });


    return out;
}

function genpath(type, hash){
    const c1 = hash.substring(0, 2);
    const c2 = hash.substring(2, 4);
    const tail = hash.substring(4);
    const path = root + "/" + type + "/" + c1 + "/" + c2 + "/" + tail;
    return path;
}

function savejson(pth, obj){
    const dir = path.dirname(pth);
    fs.mkdirSync(dir, {recursive: true});
    fs.writeFileSync(pth, JSON.stringify(obj));
}

function run(){
    const routeid = genrouteid(sourceobj);
    const pages = genpages(routeid, gpx);
    const rootpath = genpath("tracks", routeid);

    let pagequeue = [];
    let cur = [];

    pages.forEach(p => {
        if(cur.length == 0){
            cur = [p];
        }else if(cur.length >= 100){
            pagequeue.push(cur);
            cur = [];
        }else{
            cur.push(p);
        }
    });
    if(cur.length != 0){
        pagequeue.push(cur);
        cur = [];
    }
    /* Write route root file */
    const m = {
        obj: sourceobj,
        id: routeid,
        maxpages: pagequeue.length
    };
    savejson(rootpath + "/track.json", m);

    /* Write pages */
    for(const idx in pagequeue){
        const name = rootpath + "/" + idx.toString() + ".json";
        const x = {
            page: parseInt(idx),
            ids: pagequeue[idx].map(e => e.id)
        };
        savejson(name, x);
        pagequeue[idx].forEach(p => {
            const locpath = genpath("trpages", p.id) + ".json";
            savejson(locpath, p);
        });
    }
}


run();
