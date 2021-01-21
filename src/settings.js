const hash = require("object-hash");

const getKey = (key, keyId = "cache") => {
  if (typeof key === "undefined" || key === null) {
    throw new Error("undefined or null keys not allowed");
  }
  return hash({
    key,
    keyId,
  });
};

const queryDefinition = {
  query: {
    //q: "appsscript.json in:path",
    q: "filename:appsscript extension:.json",
  },
  keyId: "scrgit",
  get dataName() {
    return getKey({
      query: this.query,
      keyId: this.keyId,
    });
  },
  // the git hub api only does searches up to a 1000 results,
  // so we have to do multiple split by date
  ranges: [
    "size:<=100",
    "size:101..250",
    "size:251..400",
    "size:401..550",
    "size:>550",
  ],
  gistId: "d066837f73759c78ea86d04474732eb0",
  get gistApi() {
    return `https://api.github.com/gists/${this.gistId}`;
  },
};

https: module.exports = {
  queryDefinition,
  getKey,
};