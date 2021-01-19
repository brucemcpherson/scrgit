
class GitOwner {
  static fuzzyList = ["login"];
  static decorations = ["name", "company", "location", "email"];
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
        "html_url"
      ].reduce((p, c) => {
        p[c] = owner[c];
        return p;
      }, {});
      if (!this.fields.name) this.fields.name === this.fields.login

    }
  }

  decorate(body) {

    if (body) {
      this.constructor.decorations.forEach((f) => {
        this.fields[f] = body[f]
      });
    }
  }

  get fuzzyList() {
    return this.constructor.fuzzyList;
  }
}
module.exports = GitOwner;
