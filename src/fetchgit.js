const { gitAuth } = require("../secrets/git");
const { queryDefinition } = require("./settings");
const GitData = require("./classes/GitData");
const { Octokit } = require("@octokit/rest");

const delay = require("delay");

const { default: PQueue } = require("p-queue");

const decorateQueue = new PQueue({ concurrency: 1 });

const searchQueue = new PQueue({ concurrency: 1 });
const octokit = new Octokit({
  auth: gitAuth,
  userAgent: "brucemcpherson/scrgit v1.0.3",
});

const getGistFiles = (content, fileProp) => {
  const files = {};
  files[fileProp || queryDefinition.dataName] = {
    content,
  };
  return files;
};

const gc = ({ description, content, fileProp }) => {
  return octokit.gists
    .create({
      description,
      files: getGistFiles(content, fileProp),
      public: true,
    })
    .then((r) => {
      console.log("created gist", r.data.id, Object.keys(r.data.files));
      return r;
    });
};

const gistCreate = ({ content = "initial" } = {}) => {
  return gc({
    description: queryDefinition.query.q,
    content,
    fileProp: queryDefinition.dataName,
  });
};

const gistUpdate = ({ content = "initial" } = {}) => {
  return octokit.gists
    .update({
      files: getGistFiles(content),
      gist_id: queryDefinition.gistId,
    })
    .then((r) => {
      console.log("updated gist", r.data.id, Object.keys(r.data.files));
      return r;
    });
};

const getRateInfo = (response) => {
  const { headers } = response;

  const ratelimitRemaining = headers["x-ratelimit-remaining"];
  const ratelimitReset = headers["x-ratelimit-reset"];

  return {
    ratelimitRemaining,
    ratelimitReset,
    waitTime:
      ratelimitRemaining > 1
        ? 100
        : Math.max(2500, ratelimitReset * 1000 - new Date().getTime()),
  };
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
    incomplete: data.incomplete_results,
    status,
    response,
    ...getRateInfo(response),
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

  return octokit.search
    .code(searchOptions)
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
 * @param {function} [args.transformer] a transfornatino to apply before returning anything
 * @return {object} the response
 */
const giterator = ({
  fetcher,
  options,
  keepAll = true,
  max = Infinity,
  transformer,
  initialWaitTime = 100,
  minWait = 500,
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

        bannedCount: 0,

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
          const waitTime = this.waitTime() + minWait;
          this.stats.totalWaitTime += waitTime;
          if (waitTime > minWait) console.log("...waiting for", waitTime);
          return delay(waitTime);
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

          return this.waiter()
            .then(() =>
              fetcher({ options, page: this.page }).then((pack) => {
                // if we didnt get anything, then assume its all over
                this.pack = pack;
                const { items } = pack;
                this.stats.numberOfFetches++;
                this.bannedCount = 0;

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
            )
            .catch((err) => {
              // mabe this is an abuse thing - retry after doesn't seem tot be set so we cant use that
              if (err.status === 403) {
                this.bannedCount++;
                const { headers } = err || {};
                const retryAfter = parseInt(headers["retry-after"], 10) || 0;
                if (this.bannedCount > 5) {
                  return Promise.reject(err);
                } else {
                  const delayTime = Math.max(
                    retryAfter * 1000,
                    Math.pow(2, this.bannedCount) * 15000
                  );
                  console.log(
                    "banned and wait a bit:attempt",
                    this.bannedCount,
                    delayTime
                  );
                  return delay(delayTime).then(() => this.getMore());
                }
              } else {
                return Promise.reject(err);
              }
            });
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
            return Promise.resolve(false);
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

const fetchAllCodePart = async ({ gd, options, max, range }) => {
  const transformer = ({ data }) => {
    return gd.add(data);
  };
  const q = `${options.q}${range ? " " + range : ""}`;
  console.log("....querying", q);
  // iterator to go through the whole thing
  const grate = giterator({
    options: {
      ...options,
      q,
    },
    max,
    transformer,
    fetcher: gitSearcher,
    keepAll: false,
  });

  for await (let { index, data, pack } of grate) {
    console.log(index, data.repository.full_name, pack.waitTime);
  }

  return Promise.resolve(gd);
};

const fetchAllCode = async (options, max, ranges = [""]) => {
  const gd = new GitData();
  return Promise.all(
    ranges.map((range) => {
      return searchQueue
        .add(() => {
          return fetchAllCodePart({ gd, options, range, max });
        })
        .catch((err) => {
          console.log("failed fetchallcode", err, options);
          return Promise.reject(err);
        });
    })
  ).then(() => gd);
};

const getWithWait = (what, tries = 0) => {
  return what().catch((error) => {
    const { status } = error;
    // we get a 403 for rate limit exceeded (why not 429?)
    if ((status !== 403 && status !== 429) || tries > 3)
      return Promise.reject(error);
    const { waitTime } = getRateInfo(error);
    console.log("....waiting", waitTime);
    // try again
    return delay(waitTime).then(() => getWithWait(what, tries + 1));
  });
};

const decorateOwner = (owner) => {
  return getWithWait(() =>
    octokit.request(`GET /users/${owner.fields.login}`).then((r) => {
      owner.decorate(r.data);
      return owner;
    })
  );
};

const attachRepoProfiles = (gd) => {
  // the objective here is to attach repo information from scrviz profiles to the given repos
  gd.owners.forEach((owner) => {
    // most owners wont have scrviz profiles
    if (owner.fields.scrviz) {
      const { repos } = owner.fields.scrviz;
      if (repos) {
        // the repo is keyed by its id, not its name, so first find all repos owned by this guy
        const orepos = Array.from(gd.repos.values()).filter(
          (f) => f.ownerId === owner.id
        );
        repos.forEach((rv) => {
          const target = `${owner.fields.login}/${rv.repo}`;
          const t = orepos.find((f) => f.fields.full_name === target);
          if (!t) {
            console.log("failed to find scrviz profile repo", target);
          } else {
            // decorate the repo
            t.fields.scrviz = {
              repo: rv,
            };
          }
        });
      }
    }
  });
};

const attachProfiles = (profiles, gd) => {
  profiles.files.forEach((file) => {
    const owner = gd.owners.get(file.fields.ownerId);
    if (!owner) {
      console.log("damn - no owner for", file.fields);
    }
    const shax = profiles.shaxs.get(file.fields.sha);
    // now we can validate that the owner matches the repo owner
    // this will prevent people registering phony profiles on behalf of others
    const scrviz =
      shax && shax.fields && shax.fields.content && shax.fields.content.scrviz;
    const contentOwner = scrviz && scrviz.owner && scrviz.owner.login;

    if (!contentOwner) {
      console.log("...theres no scrviz owner for - skipping", shax);
    } else if (!owner || contentOwner !== owner.fields.login) {
      console.log(
        "...PROFILE NOT OWNED BY CORRECT OWNER",
        contentOwner,
        owner && owner.login,
        shax
      );
      // scrap it as it's not trustable
      shax.fields.content.scrviz = null;
    } else {
      console.log("....found a profile for", contentOwner);
      owner.fields.scrviz = scrviz;
    }
  });
};
const decorators = (profiles, gd) => {
  const pp = Promise.all(
    Array.from(profiles.shaxs.values()).map((f) =>
      decorateQueue.add(() => decorateProfile(f))
    )
  )

    .then(() => {
      return attachProfiles(profiles, gd);
    });

  // need the profiles to be all over first.
  const po = pp
    .then(() =>
      Promise.all(
        gd.items("owners").map((f) => decorateQueue.add(() => decorateOwner(f)))
      ).then(() =>
        console.log(`....decorated ${gd.items("owners").length} owners`)
      )
    )
    .catch((err) => {
      console.log("decorators owners", err);
    });

  const pf = Promise.all(
    gd
      .items("files")
      .map((f) => decorateQueue.add(() => decorateFile(f)))
      .concat(
        gd.items("files").map((f) => decorateQueue.add(() => decorateInfo(f)))
      )
  )
    .then(() => console.log(`....decorated ${gd.items("files").length} files`))
    .catch((err) => {
      console.log("decorators files", err);
    });

  const ps = Promise.all(
    gd.items("shaxs").map((f) => decorateQueue.add(() => decorateShax(f)))
  )
    .then(() => console.log(`....decorated ${gd.items("shaxs").length} shaxs`))
    .catch((err) => {
      console.log("shax", err);
    });
  // decorating the repos requires the owner decoration to be complete as scrviz repo information
  // is inherited from there and it will have weeded out fake owners if we take it from there
  const pr = po.then(() => {
    return attachRepoProfiles(gd);
  });

  return Promise.all([po, pr, pf, ps]).then(() => gd);
};

const tidyParse = (buf) => {
  let c = "";
  try {
    c = Buffer.from(buf, "base64").toString("utf8");
    // this double parsing is a hack to dispose of trailing commas in json
    const t = JSON.stringify(c);
    return t ? JSON.parse(JSON.parse(t)) : null;
  } catch (err) {
    console.log("failed to parse content", c);
    return null;
  }
};

const decorateFile = (file) => {
  return getWithWait(() => decorateFileWork(file));
};
const decorateInfo = (file) => {
  return getWithWait(() => decorateInfoWork(file));
};
const decorateShax = (shax) => {
  return getWithWait(() => decorateShaxWork(shax));
};
const decorateProfile = (profile) => {
  return getWithWait(() => decorateShaxWork(profile));
};
const octoCheck = ({ owner, repo, path }) => {
  return octokit.repos
    .getContent({
      method: "HEAD",
      owner,
      repo,
      path,
    })
    .then((r) => true)
    .catch((error) => {
      if (error.status === 404) {
        return false;
      }
      return error.status === 404
        ? Promise.resolve(false)
        : Promise.reject(error);
    });
};
const _patchFileName = (file, patch) => {
  const path = file.fields.path.replace("appsscript.json", patch);
  const owner = file.fields.repoFullName.replace(/(.*)\/(.*)/, "$1");
  const repo = file.fields.repoFullName.replace(/(.*)\/(.*)/, "$2");
  return {
    path,
    owner,
    repo,
    file,
  };
};
const _getTheFileContent = ({ path, owner, repo }) => {
  return octoCheck({
    owner,
    repo,
    path,
  }).then((exists) => {
    if (exists) {
      console.log("...found scriptId clue file", owner, repo, path);
      return octokit.repos.getContent({
        owner,
        repo,
        path,
      });
    } else {
      return null;
    }
  });
};
const decorateInfoWork = (file) => {
  if (file.fields.scriptId) {
    return Promise.resolve(file);
  }
  const p = _patchFileName(file, "info.json");
  return _getTheFileContent(p).then((r) => {
    if (r) {
      const c = tidyParse(r.data.content);
      file.decorate({
        scriptId: c && c.id,
      });
    }
    return file;
  });
};

const decorateFileWork = (file) => {
  const p = _patchFileName(file, ".clasp.json");
  return _getTheFileContent(p).then((r) => {
    if (r) {
      const c = tidyParse(r.data.content);
      file.decorate({
        scriptId: c && c.scriptId,
        claspHtmlUrl: r.data.html_url,
      });
    }
    return file;
  });
};

const decorateShaxWork = (shax) => {
  // this gets the content of the appsscript file
  const base = `GET /repos/${shax.fields.repoFullName}/git/blobs/${shax.fields.sha}`;
  return octokit.request(base).then((r) => {
    const content = tidyParse(r.data.content);
    shax.decorate({
      content,
    });
    return shax;
  });
};

module.exports = {
  fetchAllCode,
  gistCreate,
  gistUpdate,
  decorators,
};
