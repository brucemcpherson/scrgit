class GitOwner {
  static decorations = [
    "twitter_username",
    "name",
    "company",
    "location",
    "email",
    "bio",
    "hireable",
    "bio",
    "public_repos",
    "followers",
    "createdAt",
    "blog",
  ];
  constructor({ repository, importFields }) {
    if (importFields) {
      this.fields = importFields;
    } else {
      const { owner } = repository;
      this.fields = [
        "avatar_url",
        "html_url",
        "id",
        "login",
        "html_url",
      ].reduce((p, c) => {
        p[c] = owner[c];
        return p;
      }, {});
      if (!this.fields.name) this.fields.name = this.fields.login;
    }
  }

  decorate(body) {
    if (body) {
      this.constructor.decorations.forEach((f) => {
        this.fields[f] = body[f];
      });
      // need a tweak for missing name
      if (!this.fields.name) this.fields.name = this.fields.login;
    }
  }
}
module.exports = GitOwner;
