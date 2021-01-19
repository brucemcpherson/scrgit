class GitRepo {
  static fuzzyList = ["full_name", "name"];
  static decorations = ["stargazers", "subscribers"];

  constructor({ repository, importFields }) {
    if (importFields) {
      this.fields = importFields;
    } else {
      const { owner } = repository;
      this.fields = ["id", "full_name", "name", "html_url", "url"].reduce(
        (p, c) => {
          p[c] = repository[c];
          return p;
        },
        {}
      );
      this.fields.ownerId = owner.id;
    }
  }
  get fuzzyList() {
    return this.constructor.fuzzyList;
  }

  decorate(body) {
    if (body) {
      this.constructor.decorations.forEach((f) => {
        this.fields[f] = body[f];
      });
    }
  }
}
module.exports = GitRepo;
