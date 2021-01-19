const GitRepo = require("./classes/GitRepo");
const { decorateOwner } = require("./fetchgit");

const makeChildren = ({ map, matchId, id }) => {
  return Array.from(map.values()).filter((f) => f.fields[matchId] === id);
};

const makeManifestChildren = ({ mf, id }) => {
  const manifest = mf.manifests.get(id);
  return [
    "libraries",
    "advancedServices",
    "timeZones",
    "runtimeVersions",
    "webapps",
    "addOns",
    "oauthScopes",
  ]
    .map((f) => ({
      name: f,
      children: manifest[f],
    }))
    .filter((f) => f.children && f.children.length);
};
const makeOwnerTreeData = (gd, mf) => {
  // the objective is to make tree shaped data for d3
  // { name: owner, children: [{ name: repo: children: [{ name: libraries }, { name: advanced services }] }] }

  return Array.from(gd.owners.values()).reduce(
    (p, c) => {
      const owner = {
        owner: c,
        name: c.fields.name || c.fields.login,
        children: makeChildren({
          map: gd.repos,
          matchId: "ownerId",
          id: c.fields.id,
        }).map((f) => ({
          repo: f,
          name: f.fields.name,
          children: makeChildren({
            map: gd.files,
            matchId: "repositoryId",
            id: f.fields.id,
          }).map((g) => {
            return {
              name: f.fields.name,
              manifest: mf.manifests.get(g.fields.id),
              children: makeManifestChildren({ mf, id: g.fields.id }),
            };
          }),
        })),
      };

      p.children.push(owner);
      return p;
    },
    { name: "owners", children: [] }
  );
};

module.exports = {
  makeOwnerTreeData,
};
