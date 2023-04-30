/* Bootstrap twitter raw backup repository */

const fs = require("fs");
const path = require("path");
const entries = JSON.parse(fs.readFileSync("out.json"));
const root = "c:/cygwin64/home/oku/datarepos/rawdiary/twitter";

function genslug(url){ // => str / false
    const re = /https:\/\/twitter.com\/[^/]*\/status\/(.*)/;
    if(url){
        const m = url.match(re);
        if(m[1]){
            const str = m[1];
            if(str.length <= 6){
                const front = str.substring(0,3);
                const c1 = str.substring(3);
                return front + "/" + c1;
            }else{
                const front = str.substring(0,3);
                const c1 = str.substring(3,6);
                const c2 = str.substring(6);
                return front + "/" + c1 + "/" + c2;
            }
        }else{
            return false;
        }
    }else{
        return false;
    }
}

entries.forEach(e => {
    const slug = genslug(e.url);
    const outfile = root + "/" + slug + ".json";
    const outdir = path.dirname(outfile);
    if(! slug){
        console.log("NO SLUG", e);
    }

    fs.mkdirSync(outdir, {recursive: true});
    fs.writeFileSync(outfile, JSON.stringify(e));
});
