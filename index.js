const GitData = require("./src/classes/GitData");
const { enumerateManifests } = require("./src/gasser");
const { queryDefinition } = require("./src/settings");

const { fetchAllCode, decorators, gistCreate } = require("./src/fetchgit");

const { cacheGet, cacheSet } = require("./src/cache");
const writeJsonFile = require("write-json-file");

const argv = require("yargs/yargs")(process.argv.slice(2)).usage(
  "$0 -c -f -m -t -p -o  (create,force update, max to write, test mode -dont write update page to start at - write file"
).argv;

const _cleanSymbol = (s) => (s ? s.toLowerCase().replace(/[\W_]/g, "") : "");

// make redis from scratchyarn ad
const makeCache = ({ max = Infinity } = {}) => {
  console.log("...rebuilding cache");
  // get profiles
  return fetchAllCode(queryDefinition.profileQuery, max).then((profiles) => {
    return fetchAllCode(queryDefinition.fullQuery, max, queryDefinition.ranges)
      .then((gd) => decorators(profiles, gd))
      .then((gd) => {
        const mf = enumerateManifests(gd);
        // we can make a map of all known usersymbols
        const userSymbols = Array.from(mf._maps.libraries.values()).reduce(
          (p, library) => {
            Array.from(library.versions.values()).forEach((version) => {
              const cleaned = _cleanSymbol(version.userSymbol);
              if (!p.has(cleaned)) p.set(cleaned, []);
              p.get(cleaned).push({
                version,
                library,
                cleaned,
              });
            });
            return p;
          },
          new Map()
        );
        // the objective here is to try to establish scriptIds
        // at this point only files with a clasp file or an info.json fill know their own scriptId
        Array.from(gd.files.values())
          .filter((f) => !f.fields.scriptId)
          .forEach((file) => {
            // so what I'm looking for here is a library whose label matches
            // the name of this file
            const repo = gd.repos.get(file.fields.repositoryId);
            const { name: repoName, ownerId } = repo.fields;
            const owner = gd.owners.get(ownerId);
            const { login } = owner.fields;
            const { path } = file.fields;
            if (path.match(/appsscript.json$/)) {
              const strip = _cleanSymbol(
                path
                  .replace(/appsscript.json$/, "")
                  .replace(/\/$/, "")
                  .replace(/src$/, "")
                  .replace(/dist$/, "")
                  .replace(/^/, "/")
                  .replace(/.*\/(.*)/, "$1")
              );
              const cleanRepoName = _cleanSymbol(repoName);
              // possible this is library so we can deduce the scriptId
 
              // first lets try the repoName
              const library =
                userSymbols.get(cleanRepoName) ||
                (strip && userSymbols.get(strip));

              // maybe its buried
              if (library) {

                // so we need to check it's always the same libraryid
                const l = library[0].library

                // we'll reject if ambiuguous
                if (library.some(h => h.library.id !== l.id)) {
                  console.log(
                    `...rejected ambiguous scriptId clue library (${library.length}) matches`,
                    strip,
                    library.map(h => h.library.label + ':' + h.library.id),
                    login,
                    repoName,
                    path
                  );
                } else {
                  console.log(
                    "...found scriptId clue library",
                    strip,
                    l.label,
                    l.id,
                    login,
                    repoName,
                    path
                  );
                  file.fields.scriptId = l.id;
                }
              }
            }
          });

        return gd;
      })
      .then((gd) =>
        argv.t
          ? Promise.resolve(gd)
          : cacheSet({ value: gd.export() }).then(() => gd)
      );
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
      profiles: Array.from(gd.owners.values()).filter((f) => f.fields.scrviz)
        .length,
    });
    console.log(
      "...done after",
      ((new Date().getTime() - started) / 1000 / 60).toFixed(2),
      "mins"
    );
  }
})();
