// plugins for Squeeze service
const CrusherPluginUpstashService = () => {
  const self = this;

  // these will be specific to your plugin
  let _settings = null;

  // prefixs on redis can be any string but
  // make sure we start and end with a single slash for consistency
  const fixPrefix = (prefix) =>
    ((prefix || "") + "/").replace(/^\/+/, "/").replace(/\/+$/, "/");

  // standard function to check store is present and of the correct type
  const checkStore = () => {
    if (!_settings.chunkSize)
      throw "You must provide the maximum chunksize supported";
    if (!_settings.prefix)
      throw "The prefix must be the path of a folder eg /crusher/store";
    if (!_settings.tokenService || typeof _settings.tokenService !== "function")
      throw "There must be a tokenservice function that returns an oauth token";
    if (!_settings.fetcher || typeof _settings.fetcher !== "function")
      throw "There must be a fetch function that can do a urlfetch (url,options)";
    return self;
  };

  /**
   * @param {object} settings these will vary according to the type of store
   */
  self.init = function (settings) {
    _settings = settings || {};

    // the settings are the same as the crusher settings
    _settings.store = {
      ug: bmUpstash.gqlRedis({
        fetcher: _settings.fetcher,
        tokenService: _settings.tokenService,
      }),
    };

    // make sure we start and end with a single slash
    _settings.prefix = fixPrefix(_settings.prefix);

    // upstash supports value sizes of up to 1mb - but actually it doesn't work above 400k for now.
    // see - https://github.com/upstash/issues/issues/3
    _settings.chunkSize = _settings.chunkSize || 400000;

    // respect digest can reduce the number of chunks read, but may return stale
    _settings.respectDigest = typeof _settings.respectDigest === typeof undefined
      ? false
      : _settings.respectDigest;

    // must have a cache service and a chunksize, and the store must be valid
    checkStore();

    // now initialize the squeezer
    self.squeezer = new Squeeze.Chunking()
      .setStore(_settings.store)
      .setChunkSize(_settings.chunkSize)
      .funcWriteToStore(write)
      .funcReadFromStore(read)
      .funcRemoveObject(remove)
      .setRespectDigest(_settings.respectDigest)
      .setCompressMin(_settings.compressMin)
      .setPrefix(_settings.prefix);

    // export the verbs
    self.put = self.squeezer.setBigProperty;
    self.get = self.squeezer.getBigProperty;
    self.remove = self.squeezer.removeBigProperty;
    return self;
  };

  // return your own settings
  self.getSettings = () => _settings;

  /**
   * remove an item
   * @param {string} key the key to remove
   * @return {object} whatever you  like
   */
  const remove = (store, key) => {
    checkStore();
    return store.ug.execute("Del", key);
  };

  /**
   * write an item
   * @param {object} store whatever you initialized store with
   * @param {string} key the key to write
   * @param {string} str the string to write
   * @param {number} expiry time in secs .. ignored in drive
   * @return {object} whatever you like
   */
  const write = (store, key, str, expiry) => {
    checkStore();
    const result = !expiry
      ? store.ug.execute("Set", key, str)
      : store.ug.execute("SetEX", key, str, expiry);
    if (result !== "OK") throw new Error("failed to set value for key", key);
    return result;
  };

  /**
   * read an item
   * @param {object} store whatever you initialized store with
   * @param {string} key the key to write
   * @return {object} whatever you like
   */
  const read = (store, key) => {
    checkStore();
    return store.ug.execute("Get", key);
  };
};

module.exports = {
  CrusherPluginUpstashService,
};
