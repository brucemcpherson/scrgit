// this used to be on redis, but we need it client side now
// so the is a just a gist compressed
const { compress, decompress } = require("./compress");
const { queryDefinition } = require("./settings");
const got = require("got");
const { gistUpdate } = require("./fetchgit");
const { gqlRedis } = require("./upstash");
const { upstashrw, upstashKey, upstashr } = require("../secrets/git");

// this should get us the latest raw url for this gist
const raw = (url) => {
  console.log("...looking for gist link in ", url);
  return got
    .get(url)
    .json()
    .then((r) => {
      return r.files && r.files[Object.keys(r.files)[0]].raw_url;
    });
};

// cache is using gist now
const cacheGet = async () => {
  // no need for the github api to get this
  const rawUrl = await raw(queryDefinition.gistApi);
  console.log("...looking for cached data in ", rawUrl);
  return got.get(rawUrl).then((r) => {
    return r && r.body ? decompress(r.body) : null;
  });
};

// write to gist - not required in client version
const cacheSet = ({ value }) => {
  return gistUpdate({
    content: compress({
      value,
      timestamp: new Date().getTime(),
    }),
  });
};

const upstashSet = ({ value }) => {
  const g = gqlRedis({ tokenService: () => upstashrw });
  return g.execute(
    "Set",
    upstashKey,
    JSON.stringify({
      content: compress({
        value,
        timestamp: new Date().getTime(),
      }),
    })
  );
};

const upstashGet = () =>
  gqlRedis({ tokenService: () => upstashr }).execute("Get", upstashKey).then(r => { 
    return r && decompress(JSON.parse(r).content)
  })

module.exports = {
  cacheGet,
  cacheSet,
  upstashSet,
  upstashGet,
};
