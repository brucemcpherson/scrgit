const GitData = require("./src/classes/GitData");
const { enumerateManifests } = require("./src/gasser");
const { queryDefinition } = require("./src/settings");

const { fetchAllCode, decorators, gistCreate } = require("./src/fetchgit");

const { cacheGet, cacheSet } = require("./src/cache");
const writeJsonFile = require("write-json-file");

const argv = require("yargs/yargs")(process.argv.slice(2)).usage(
  "$0 -c -f -m -t -p -o  (create,force update, max to write, test mode -dont write update page to start at - write file"
).argv;

// make redis from scratchyarn ad
const makeCache = ({ max = Infinity } = {}) => {
  console.log("...rebuilding cache");
  // get profiles
  return fetchAllCode(queryDefinition.profileQuery, max).then((profiles) => {
    return fetchAllCode(queryDefinition.fullQuery, max)
      .then((gd) => decorators(profiles,gd))
      .then((gd) =>
        (argv.t
          ? Promise.resolve(gd)
          : cacheSet({ value: gd.export() }).then(() => gd)
        ).then((gd) => {
          const mf = enumerateManifests(gd);
          return gd;
        })
      )
      .catch((err) => {
        console.log("caught", err);
      });
  });
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
  const started = new Date().getTime();
  // unusually we might need to create a new file
  if (argv.c) {
    await gistCreate();
  } else {
    // this will get from cache, or create new data if there's no cache data or if it's forced to
    const gd = await getFromCache({ noCache: argv.f, max: argv.m });

    // this not required here but it will validate the contents at least
    const mf = enumerateManifests(gd);

    if (argv.o) {
      await writeJsonFile(argv.o, gd.export());
    }
    console.log({
      repos: gd.repos.size,
      owners: gd.owners.size,
      files: gd.files.size,
      shaxs: gd.shaxs.size,
      advancedServices: mf.maps.advancedServices.size,
      libraries: mf.maps.libraries.size,
      timeZones: mf.maps.timeZones.size,
      runtimeVersions: mf.maps.runtimeVersions.size,
      webapps: mf.maps.webapps.size,
      addOns: mf.maps.addOns.size,
      oauthScopes: mf.maps.oauthScopes.size,
      dataStudios: mf.maps.dataStudios.size,
      claspProjects: Array.from(gd.files.values()).filter(
        (f) => f.fields.claspHtmlUrl
      ).length,
    });
    console.log(
      "...done after",
      ((new Date().getTime() - started) / 1000 / 60).toFixed(2),
      "mins"
    );
  }
})();
