class GitShax {
  static decorations = ["content"];
  constructor(data) {
    if (data.importFields) {
      this.fields = data.importFields;
    } else {
      this.fields = ['sha'].reduce((p, c) => {
        p[c] = data[c];
        return p;
      }, {});
      this.fields.id = data.sha;
      // since these files are often duplicate content
      // avoiding duplicating for each file by just taking the content by sha
      this.fields.repoFullName = data.repository.full_name;
    }
  }
  decorate(body) {
    if (body) {
      this.constructor.decorations.forEach((f) => {
        this.fields[f] = body[f];
      });
    }
  }
}
module.exports = GitShax;
