class GitShax {
  static fuzzyList = ["id"];
  constructor(data) {
    if (data.importFields) {
      this.fields = data.importFields;
    } else {
      this.fields = [].reduce((p, c) => {
        p[c] = data[c];
        return p;
      }, {});
      this.fields.id = data.sha;
    }
  }
  get fuzzyList() {
    return this.constructor.fuzzyList;
  }
}
module.exports = GitShax;
