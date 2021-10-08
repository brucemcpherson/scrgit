const writeJsonFile = require("write-json-file");
const loadJsonFile = require("load-json-file");
const { cacheSet } = require("./src/cache");
const { init: psInit } = require("./src/psdo");
const argv = require("yargs/yargs")(process.argv.slice(2)).usage(
  "$0 -t -n -p f1,f2,f3.. -o output"
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
    owners: 0,
  };
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
  return Object.keys(nob).reduce(
    (p, c) => {
      p.nob[c] = Array.from(nob[c].values());
      return p;
    },
    { sob, nob: {} }
  );
};

const publish = (connection) => {
  return connection.publish({
    name: "scrgit.topicName",
    ob: {
      timestamp: new Date().getTime(),
      workType: "scrgit",
    },
  });
};
(async () => {
  // initialize pubsub
  const ps = psInit();

  // merge all the files
  const r = await merge(argv.n.split(","));
  console.log(r.sob);
  const value = r.nob;
  // if there's an output file needed then do that
  await (argv.o ? writeJsonFile(argv.o, value) : Promise.resolve(null));

  // write to cache if necessary
  const cached = (await argv.t) ? Promise.resolve(null) : cacheSet({ value });
  cached.then((r) => {
    // publish a process message - can still publish even if cache is not updated
    // to forece a pub anyway
    // we're not doing upstash yet as the value is too large
    return argv.p ? publish(ps) : Promise.resolve(null);
  });
})();
