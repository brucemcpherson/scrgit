class Gql {
  // fetcher should include auth setup
  constructor({ fetcher, url }) {
    this.fetcher = fetcher;
    this.url = url;
  }

  execute(command, ...vargs) {
    const cmd = "redis" + command;
    const payload = this[cmd](...vargs);

    return this.fetcher(this.url, {
      method: "POST",
      json: payload,
    }).then((result) => {
      return result && result.data && result.data[cmd];
    });
  }

  redisGet(key) {
    return {
      query: `query($key: String!) {
        redisGet(key:$key)
      }`,
      variables: {
        key,
      },
    };
  }

  redisSetEX(key, value, seconds) {
    return {
      query: `mutation($key: String!,$value:String!,$seconds:Int!) {
        redisSetEX(key:$key, value:$value,seconds:$seconds)
      }`,
      variables: {
        key,
        value,
        seconds,
      },
    };
  }

  redisDel(keys) {
    keys = Array.isArray(keys) ? keys : [keys];
    return {
      query: `mutation($keys: [String!]!) {
        redisDel(keys:$keys)
      }`,
      variables: {
        keys,
      },
    };
  }

  redisSet(key, value) {
    return {
      query: `mutation($key: String!,$value:String!) {
        redisSet(key:$key, value:$value)
      }`,
      variables: {
        key,
        value,
      },
    };
  }
}
module.exports = Gql;
