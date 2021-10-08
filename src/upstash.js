const got = require("got");
const Gql = require("./classes/Gql");
const gqlRedis = ({
  tokenService,
  url = "https://graphql-eu-west-1.upstash.io/",
} = {}) => {
  if (!tokenService)
    throw new Error(
      `Must specify a tokenservice function - should return your upstash read or read/write access key eg () => rwkey`
    );
  return new Gql({ fetcher: fgot(tokenService), url });
};
const fgot = (tokenService) => {
  return (url, options = {}) => {
    if (tokenService) {
      options.headers = options.headers || {};
      options.headers.authorization = `Bearer ${tokenService()}`;
    }
    return got(url, options).json();
  };
};
module.exports = {
  gqlRedis,
};
