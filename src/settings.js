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
    q: "appsscript.json in:path",
  },
  keyId: "scrgit",
  get dataName() {
    return getKey({
      query: this.query,
      keyId: this.keyId,
    });
  },
  // TODO - make this rebuildable by searching gists
  gistId: "d066837f73759c78ea86d04474732eb0",
  get gistApi() { 
    return `https://api.github.com/gists/${this.gistId}`;
  }
};
//gist.githubusercontent.com/brucemcpherson/52534a2d401ec83e99aee76bd37af274/raw/59b66ba9c5b14567cb3880b892688c26d75bd946/dbb52fc3f291b2ac8263d96519dd6ae2ce750699

https: module.exports = {
  queryDefinition,
  getKey,
};