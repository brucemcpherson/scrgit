
const writeJsonFile = require("write-json-file");
const loadJsonFile = require("load-json-file");
const { cacheSet } = require("./src/cache");
const argv = require("yargs/yargs")(process.argv.slice(2)).usage(
  "$0 -t -n f1,f2,f3.. -o output"
).argv;

const merge = async (names) => {
  //because the git api drops lots of stuff, we can run it a couple of times and merge the results
  //files should be newest first
  const nob = {
    shaxs: new Map(),
    files: new Map(),
    repos: new Map(),
    owners: new Map(),
  };
  const sob = {
    shaxs: 0,
    files: 0,
    repos: 0,
    owners: 0
  }
  const files = await Promise.all(names.map(loadJsonFile));
  files.forEach((file, i) => {
    Object.keys(file).forEach((k) => {
      file[k].forEach((f) => {
        if (!nob[k].has(f.id)) {
          nob[k].set(f.id, f);
          sob[k]++;
        }
      });
    });
  });
  return Object.keys(nob).reduce((p, c) => { 
    p.nob[c] = Array.from(nob[c].values())
    return p;
  }, { sob, nob: {}})
};

(async () => { 
  const r = await merge(argv.n.split(","))
  console.log(r.sob)
  await argv.o ? writeJsonFile(argv.o, r.nob) : Promise.resolve(null)
  await argv.t ? Promise.resolve(null) : cacheSet({ value: r.nob })
})()