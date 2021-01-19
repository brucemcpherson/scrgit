// this used to be on redis, but we need it client side now
// so the is a just a gist compressed
const { compress, decompress } = require("./compress");
const { queryDefinition } = require("./settings");
const got = require("got");
const { gistUpdate } = require ('./fetchgit')

// this should get us the latest raw url for this gist
const raw = () => { 
  return got.get(queryDefinition.gistApi).json()
    .then(r => { 
      return r.files && r.files[Object.keys(r.files)[0]].raw_url
    })
}

// cache is using gist now
const cacheGet = async () => {
  // no need for the github api to get this
  const rawUrl = await raw()
  return got.get(rawUrl)
    .then((r) => {
      return r && r.body ? decompress(r.body) : null
    })
}

// write to gist - not required in client version
const cacheSet = ({ value }) => {
  return gistUpdate({
    content: compress({
      value,
      timestamp: new Date().getTime(),
    })
  })
}

module.exports = {
  cacheGet,
  cacheSet
};
