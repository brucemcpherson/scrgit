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
    q: "filename:appsscript extension:.json",
  },
  profileQuery: {
    q: "filename:scrviz-profile extension:.json",
  },
  sorting: " sort:indexed",
  keyId: "scrgit",
  get fullQuery() {
    return {
      q: `${this.query.q}${this.sorting}`,
    };
  },
  get dataName() {
    return getKey({
      query: this.query,
      keyId: this.keyId,
    });
  },
  // the git hub api only does searches up to a 1000 results,
  // so we have to do multiple split by date
  ranges: [
    "size:<100",
    "size:100..199",
    "size:200..299",
    "size:300..399",
    "size:400..499",
    "size:500..599",
    "size:>599",
  ],
  gistId: "9daba5fb20a97d020431fe4a114011c7",
  get gistApi() {
    return `https://api.github.com/gists/${this.gistId}`;
  },
};

https: module.exports = {
  queryDefinition,
  getKey,
};
