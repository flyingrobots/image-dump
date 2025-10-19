const fs = require('fs').promises;
const path = require('path');

class ImageManifest {
  constructor(manifestPath, fileSystem = fs) {
    this.manifestPath = manifestPath;
    this.fs = fileSystem;
    this.records = {};
    this.loaded = false;
    this.dirty = false;
  }

  async load() {
    if (this.loaded) {
      return this.records;
    }

    try {
      const raw = await this.fs.readFile(this.manifestPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.records) {
        this.records = parsed.records;
      } else {
        this.records = {};
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      this.records = {};
    }

    this.loaded = true;
    this.dirty = false;
    return this.records;
  }

  get(key) {
    return this.records[key];
  }

  update(key, record) {
    this.records[key] = record;
    this.dirty = true;
  }

  remove(key) {
    if (this.records[key]) {
      delete this.records[key];
      this.dirty = true;
    }
  }

  has(key) {
    return Object.prototype.hasOwnProperty.call(this.records, key);
  }

  isDirty() {
    return this.dirty;
  }

  async save() {
    if (!this.loaded || !this.dirty) {
      return;
    }

    const dir = path.dirname(this.manifestPath);
    await this.fs.mkdir(dir, { recursive: true });
    const payload = JSON.stringify({ records: this.records }, null, 2);
    await this.fs.writeFile(this.manifestPath, payload, 'utf8');
    this.dirty = false;
  }
}

module.exports = ImageManifest;
