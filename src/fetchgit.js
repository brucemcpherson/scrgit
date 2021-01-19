const { auth, gistAuth } = require("../secrets/git");
const { queryDefinition } = require("./settings");
const GitData = require("./classes/GitData");
const { compress } = require("./compress");

const { Octokit } = require("@octokit/rest");
const { throttling } = require("@octokit/plugin-throttling");

const Octothrot = Octokit.plugin(throttling);

const throttle = {
  onRateLimit: (retryAfter, options, octokit) => {
    octokit.log.warn(
      `Request quota exhausted for request ${options.method} ${options.url}`
    );

    if (options.request.retryCount === 0) {
      // only retries once
      octokit.log.warn(`Retrying after ${retryAfter} seconds!`);
      return true;
    }
  },
  onAbuseLimit: (retryAfter, options, octokit) => {
    // does not retry, only logs a warning
    octokit.log.warn(
      `Abuse detected for request ${options.method} ${options.url}`
    );
  },
};
const octokit = new Octothrot({
  auth,
  userAgent: "scrgit v1.0.1",
  throttle,
});

const octoGist = new Octothrot({
  auth: gistAuth,
  userAgent: "scrgist v1.0.1",
  throttle,
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

const fetchAllCode = async (options, max) => {
  const gd = new GitData();
  const request = "GET /search/code";
  let totalEntries = 0;
  for await (const response of octokit.paginate.iterator(request, options)) {
    response.data.forEach((f) => gd.add(f));
    console.log("...added ", response.data.length, "entries", totalEntries);
    totalEntries += response.data.length;
    if (totalEntries > max) break;
  }
  console.log("...found", totalEntries, "entries");
  return gd;
};

const decorateOwner = (owner) => {
  return octokit.request(`GET /users/${owner.fields.login}`).then((r) => {
    owner.decorate(r.data);
    return owner;
  });
};

const decorateRepo = async (repo) => {
  const base = `GET /repos/${repo.fields.full_name}`;
  const body = {
    stargazers: 0,
    subscribers: 0,
  };
  for await (const response of octokit.paginate.iterator(
    `${base}/stargazers`
  )) {
    body.stargazers += response.data.length;
  }
  for await (const response of octokit.paginate.iterator(
    `${base}/subscribers`
  )) {
    body.subscribers += response.data.length;
  }
  repo.decorate(body);
  return repo;
};

const decorateFile = (file) => {
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
  decorateOwner,
  decorateRepo,
  decorateFile,
  gistCreate,
  gistUpdate,
};
