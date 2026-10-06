/** @jsx etch.dom */
const etch = require("@lumine-code/etch");
const CodeBlock = require("./code-block");

module.exports = class HTMLExample {
  constructor({ html }) {
    this.html = html;
    this.destroyed = false;
    etch.initialize(this);
    this.capturePreviewEditors();
  }

  render() {
    return (
      <div className="example">
        <div ref="preview" className="example-rendered" innerHTML={this.html} />
        <div className="example-code">
          <CodeBlock cssClass="example-html" grammarScopeName="text.html.basic" code={this.html} />
        </div>
      </div>
    );
  }

  update({ html }) {
    if (this.destroyed || html === this.html) return Promise.resolve();
    this.destroyPreviewEditors();
    this.html = html;
    return etch.update(this).then(() => {
      if (!this.destroyed) this.capturePreviewEditors();
    });
  }

  capturePreviewEditors() {
    this.previewEditors = Array.from(
      this.refs.preview.querySelectorAll("lumine-text-editor"),
      (element) => element.getModel(),
    );
  }

  destroyPreviewEditors() {
    for (const editor of this.previewEditors) editor.destroy();
    this.previewEditors = [];
  }

  destroy() {
    if (this.destroyed) return this.destructionPromise;
    this.destroyed = true;
    this.destroyPreviewEditors();
    this.destructionPromise = etch.destroy(this);
    return this.destructionPromise;
  }
};
