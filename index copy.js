const GitData = require("./src/classes/GitData");
const { enumerateManifests } = require("./src/gasser");
const { makeOwnerTreeData } = require("./src/d3prep");
const { queryDefinition } = require("./src/settings");

const {
  fetchAllCode,
  decorateRepo,
  decorateOwner,
  decorateFile,
} = require("./src/fetchgit");

const { cacheGet, cacheSet } = require("./src/cache");
const Rottler = require("rottler");

const argv = require("yargs/yargs")(process.argv.slice(2)).usage(
  "$0 -f -m -t (force update, max to write, test mode -dont write update"
).argv;

// make redis from scratch
const makeCache = ({ max = Infinity } = {}) => {
  console.log("...rebuilding cache");
  const rot = new Rottler({
    rate: 200,
    period: 20 * 1000,
    delay: 100,
    smooth: true,
  });

  const rotter = async ({ gd, type, transformer }) => {
    rot.reset();
    const rowIterator = rot.rowIterator({
      rows: gd.items(type),
      transformer,
    });
    for await (let { index } of rowIterator) {
    }
    console.log("....decorated", type);
  };

  return fetchAllCode(queryDefinition.query, max)
    .then(async (gd) => {
      await rotter({
        gd,
        type: "owners",
        transformer: ({ row }) => decorateOwner(row),
      });
      await rotter({
        gd,
        type: "repos",
        transformer: ({ row }) => decorateRepo(row),
      });
      await rotter({
        gd,
        type: "files",
        transformer: ({ row }) => decorateFile(row),
      });
      return gd;
    })

    .then((gd) => argv.t ? Promise.resolve(gd) : cacheSet({ value: gd.export() }).then(() => gd));
}; 

// preferably get from redis
const getFromCache = async ({ noCache, max }) => {
  if (noCache) return makeCache({ max });
  (await noCache) ? makeCache({ max }) : Promise.resolve(null);

  return cacheGet().then((result) => {
    const { value, timestamp } = result || {};
    if (value) {
      console.log(
        `Using cached data from ${
          (new Date().getTime() - timestamp) / 60 / 1000 / 60
        } hours ago`
      );
      return new GitData(value);
    } else {
      return getFromCache({ noCache: true, max });
    }
  });
};

(async () => {
  const gd = await getFromCache({ noCache: argv.f, max: argv.m });
  const mf = enumerateManifests(gd);
  //console.log(JSON.stringify(Array.from(gd.repos.values()).map(f=>f.fields.name).sort()))
  /*
  console.log(Array.from(mf.maps.advancedServices));
  console.log(Array.from(mf.maps.libraries));
  console.log(Array.from(mf.maps.timeZones));
  console.log(Array.from(mf.maps.runtimeVersions));
  console.log(Array.from(mf.maps.webapps));
  console.log(Array.from(mf.maps.addOns));
  console.log(Array.from(mf.maps.oauthScopes));
  console.log(mf.labels("libraries"));
  console.log(mf.labels("advancedServices"));
  console.log(mf.labels("timeZones"));
  console.log(mf.labels("runtimeVersions"));
  console.log(mf.labels("webapps"));
  console.log(mf.labels("addOns"));
  console.log(mf.labels("oauthScopes"));
  */
  const td = makeOwnerTreeData(gd, mf);
  //if(argv.t)console.log(td);
})();
