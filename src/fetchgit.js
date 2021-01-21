const { auth, gistAuth } = require("../secrets/git");
const { queryDefinition } = require("./settings");
const GitData = require("./classes/GitData");
const { Octokit } = require("@octokit/rest");
const { default: PQueue } = require("p-queue");
const queue = new PQueue({ concurrency: 1 });

const octokit = new Octokit({
  auth,
  userAgent: "scrgit v1.0.1",
});

const octoGist = new Octokit({
  auth: gistAuth,
  userAgent: "scrgist v1.0.1",
});

const getGistFiles = (content) => {
  const files = {};
  files[queryDefinition.dataName] = {
    content,
  };
  return files;
};
const gistCreate = ({ content }) => {
  return octoGist.gists
    .create({
      description: queryDefinition.query.q,
      files: getGistFiles(content),
      public: true,
    })
    .then((r) => {
      console.log("created gist", r.data.id, Object.keys(r.data.files));
      return r;
    });
};

const gistUpdate = ({ content }) => {
  return octoGist.gists
    .update({
      files: getGistFiles(content),
      gist_id: queryDefinition.gistId,
    })
    .then((r) => {
      console.log("updated gist", r.data.id, Object.keys(r.data.files));
      return r;
    });
};

/**
 * sort out reponse from octokit
 * @param {object} response from ocotokit
 */
const gitUntangle = (response, options) => {
  const { data, headers } = response;
  const { total_count } = data;
  const { status } = headers;
  const items = data.items || data;
  const ratelimitRemaining = headers["x-ratelimit-remaining"];
  const ratelimitReset = headers["x-ratelimit-reset"];

  // sometimes there's items, sometimes not
  if (total_count) {
    console.log({
      total_count,
      item_count: items.length,
      incomplete: data.incomplete_results,
    });
  }
  if (options.per_page !== items.length && total_count) {
    console.log("...asked for", options.per_page, "got", items.length);
  }
  return {
    // these are needed
    items,
    total: total_count,
    // this is how long the next attempt will have to wait before trying again
    // wait an additional time to allow for missynced times
    waitTime:
      ratelimitRemaining > 0
        ? 0
        : ratelimitReset * 1000 - new Date().getTime() + 2000,
    // this might be handy
    ratelimitReset,
    ratelimitRemaining,
    incomplete: data.incomplete_results,
    status,
    response,
  };
};

/**
 * do a search
 * @param {object} [args]
 * @param {object} args.options the search options
 * @param {number} [args.page=0] the page number to get
 * @return {object} the response
 */
const gitSearcher = ({ options, page = 0 } = {}) => {
  // noticed that
  // sort doesnt work
  // you get back things in a random order - run the same query twice - get different results
  // make the per page too big and it silently drops some results

  const searchOptions = {
    per_page: 15,
    ...options,
    page,
  };
  console.log("gitSearcher options", searchOptions);
  return octokit.search
    .code(searchOptions)
    .then((response) => gitUntangle(response, searchOptions));
};

const gitGazers = ({ options, page = 0 } = {}) => {
  const searchOptions = {
    per_page: 10,
    ...options,
    page,
  };
  return octokit.activity
    .listStargazersForRepo(searchOptions)
    .then((response) => gitUntangle(response, searchOptions));
};

/**
 * make an iterator
 * @param {object} args
 * @param {function} args.fetcher how to get some more
 * @param {object} [args.options] the options
 * @param {number} [args.keepAll= true] whether to keep all the items received
 * @param {number} [args.max= Infinity] the max number to retrieve in total
 * @param {number} [args.initialWaitTime= 0] the initial wait time before starting
 * @param {function} [args.transformer= Infinity] a transfornatino to apply before returning anything
 * @return {object} the response
 */
const giterator = ({
  fetcher,
  options,
  keepAll = true,
  max = Infinity,
  transformer,
  initialWaitTime = 0,
}) => {
  return {
    [Symbol.asyncIterator]() {
      return {

        // whenther the last chunk has been received
        finished: false,

        // which page we are on
        page: 0,

        // what we got in the last fetch
        pack: null,

        // the full set of items kept if keepAll is true
        items: [],

        // how long to wait before going
        waitTime() {
          return this.pack ? this.pack.waitTime : initialWaitTime;
        },

        // index into items to return on next()
        itemIndex: 0,

        // the overall index
        index: 0,

        // for reporting
        stats: {
          startedAt: null,
          finishedAt: null,
          numberOfFetches: 0,
          totalWaitTime: 0,
        },

        // wait for some amout of time before next
        waiter() {
          // always wait at least 120ms anyway
          const minWait = 120;
          const waitTime = this.waitTime() + minWait;
          this.stats.totalWaitTime += waitTime;
          if (waitTime > minWait) console.log("...waiting for", waitTime);
          return waitTime
            ? new Promise((resolve) =>
                setTimeout(() => resolve(waitTime), waitTime)
              )
            : Promise.resolve(0);
        },

        // report might be called when iteration is over
        report() {
          return {
            finished: this.finished,
            keepAll,
            index: this.index - 1,
            stats: this.stats,
            max,
          };
        },
        // get another chunk
        getMore() {
          if (this.finished) {
            throw new Error("attempt to get more after finish");
          }
          // record that we've started
          if (!this.pack) {
            this.stats.startedAt = new Date().getTime();
          }

          return this.waiter().then(() =>
            fetcher({ options, page: this.page }).then((pack) => {
              // if we didnt get anything, then assume its all over
              this.pack = pack;
              const { items } = pack;
              this.stats.numberOfFetches++;

              if (!items.length) {
                this.wrapup();
              } else {
                // this is whether we need to keep all the results ever got
                if (keepAll) {
                  Array.prototype.push.apply(this.items, items);
                } else {
                  this.items = items;
                  this.itemIndex = 0;
                }
              }
              // ready for next page
              this.page++;
            })
          );
        },

        wrapup() {
          this.finished = true;
        },

        // checking hasnext, will potentially involve a get
        hasNext() {
          // definitely finished
          if (this.finished) {
            return Promise.resolve(false);
          }
          // finished because we've had enough
          if (this.index >= max) {
            this.wrapup();
            return Promise.resolve(false)
          }

          // havent done with those we already have
          if (this.itemIndex < this.items.length) return Promise.resolve(true);

          // we don't know if its finished so get some more and find out
          return this.getMore().then((r) => !this.finished);
        },

        // get next item
        async next() {
          // see if there are any - this will fetch some if needed
          const hasNext = await this.hasNext();
          this.stats.finishedAt = new Date().getTime();

          // wrap up
          if (!hasNext) {
            return Promise.resolve({
              done: true,
            });
          }

          // construct the result to deliver
          const value = {
            // these are like the args returned by [].forEach (data, index, items)
            data: this.items[this.itemIndex++],
            index: this.index++,
            items: this.items,

            // this is the response to the last fetch - could be useful for things like total items
            pack: this.pack,
            nextPage: this.page,

            // this is the progress reprt
            report: this.report(),
          };

          // if there.s a transformer, add it
          if (transformer) {
            value.transformation = transformer(value);
          }
          return {
            done: false,
            value,
          };
        },
      };
    },
  };
};

const fetchAllCodePart = async ({ gd, options, max , range}) => {
  
  const transformer = ({ data }) => {
    return gd.add(data);
  };

  // iterator to go through the whole thing
  const grate = giterator({
    options: {
      ...options,
      q: `${options.q} ${range}`,
    },
    max,
    transformer,
    fetcher: gitSearcher,
    keepAll: false,
  });

  for await (let { nextPage, index, data, report } of grate) {
    // console.log("page,index", nextPage, index, data.url, report);
    console.log(index,data.repository.full_name)
  }

  return Promise.resolve(gd);
};

const fetchAllCode = async (options, max) => {
  const gd = new GitData();
  return Promise.all(queryDefinition.ranges.map(range => {
    return queue.add(() => {
      return fetchAllCodePart({ gd, options, range, max })
    })
  })).then (()=> gd)

};
const decorateOwner = (owner) => {
  return octokit.request(`GET /users/${owner.fields.login}`).then((r) => {
    owner.decorate(r.data);
    return owner;
  });
};

const decorators = (gd) => {
  const po = Promise.all(
    gd.items("owners").map((f) => queue.add(() => decorateOwner(f)))
  ).then(()=>console.log(`....decorated ${gd.items("owners").length} owners`));
  /* this is no longer required
  const pr = Promise.all(
    gd.items("repos").map((f) => queue.add(() => decorateRepo(f)))
  ).then(() =>
    console.log(`....decorated ${gd.items("repos").length} repos`)
  );
*/
  const pr = Promise.resolve()

  const pf = Promise.all(
    gd.items("files").map((f) => queue.add(() => decorateFile(f)))
  ).then(() =>
    console.log(`....decorated ${gd.items("files").length} files`)
  );

  return Promise.all([po, pr, pf]).then(() => gd);
};


const decorateRepo =  (repo) => {
  // this is deprec - no longer bothering with this
  /*
  const body = {
    stargazers: 0,
  };

  const grate = giterator({
    options: {
      owner: repo.fields.full_name.replace(/(.*)\/(.*)/, "$1"),
      repo: repo.fields.full_name.replace(/(.*)\/(.*)/, "$2"),
    },
    fetcher: gitGazers,
  });

  for await (const { report } of grate) {
    body.stargazers++;
  }

  repo.decorate(body);
  */
  return Promise.resolve(repo);
};

const decorateFile = (file) => {
  // this gets the content of the appsscript file
  const base = `GET /repos/${file.fields.repoFullName}/git/blobs/${file.fields.sha}`;
  return octokit.request(base).then((r) => {
    file.decorate({
      content: Buffer.from(r.data.content, "base64").toString("utf8"),
    });
    return file;
  });
};

module.exports = {
  fetchAllCode,
  gistCreate,
  gistUpdate,
  decorators,
};
