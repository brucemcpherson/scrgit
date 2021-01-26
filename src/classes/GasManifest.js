class GasManifest {
  constructor(shax) {
    this.shax = shax;
    const content = this.shax && this.shax.fields && this.shax.fields.content;
    try {
      // some manifests have trailing commas, we can fix it by double parsing
      const t = JSON.stringify(content);
      this.manifest = t ? JSON.parse(JSON.parse(t)) : null;
    } catch (err) {
      console.log(
        "skipping after failed to parse manifest",
        this.firstRepoName,
        content
      );
      this.manifest = null;
    }
  }

  get id() {
    return this.shax.id;
  }

  prop(type) {
    return this.manifest && this.manifest[type];
  }
  get firstRepoName() { 
    return (
      this.shax && this.shax && this.shax.fields && this.shax.fields.repoFullName
    );
  }
  get advancedServices() {
    return this.dependencies && this.dependencies.enabledAdvancedServices;
  }
  get libraries() {
    /* 
      "developmentMode": boolean,
      "libraryId": string,
      "userSymbol": string,
      "version": string
    */
    return this.dependencies && this.dependencies.libraries;
  }
  get dependencies() {
    /* 
    "serviceId": string,
    "userSymbol": string,
    "version": string
  */
    return this.prop("dependencies");
  }
  get timeZone() {
    return this.prop("timeZone");
  }
  get addOns() {
    return this.prop("addOns");
  }

  get runtimeVersion() {
    return this.prop("runtimeVersion");
  }
  get webapp() {
    return this.prop("webapp");
  }
  get oauthScopes() {
    return this.prop("oauthScopes");
  }
  get dataStudio() {
    return this.prop("dataStudio");
  }
}

module.exports = GasManifest;
