/** @jsx etch.dom */
const etch = require("@lumine-code/etch");

module.exports = class StyleguideSection {
  constructor(props, children = []) {
    this.collapsed = props.collapsed ?? true;
    this.loaded = !this.collapsed;
    this.title = props.title;
    this.name = props.name;
    this.children = children;
    this.onDidExpandOrCollapseSection = props.onDidExpandOrCollapseSection;
    this.destroyed = false;
    etch.initialize(this);
    if (props.onDidInitialize) {
      props.onDidInitialize(this);
    }
  }

  render() {
    return (
      <section
        className={`bordered${this.collapsed ? " collapsed" : ""}`}
        dataset={{ name: this.name }}
      >
        <h2 className="section-heading">
          <button
            className="section-toggle"
            type="button"
            attributes={{ "aria-expanded": String(!this.collapsed) }}
            onclick={() => this.toggle()}
          >
            {this.title}
          </button>
        </h2>
        {this.loaded ? this.children : []}
      </section>
    );
  }

  update(props = {}, children) {
    if (this.destroyed) return Promise.resolve();
    if (Object.hasOwn(props, "title")) {
      this.title = props.title;
    }

    if (Object.hasOwn(props, "name")) {
      this.name = props.name;
    }

    if (children !== undefined) {
      this.children = children;
    }

    if (Object.hasOwn(props, "onDidExpandOrCollapseSection")) {
      this.onDidExpandOrCollapseSection = props.onDidExpandOrCollapseSection;
    }

    const changed = Object.hasOwn(props, "collapsed") && this.collapsed !== props.collapsed;
    if (changed) {
      this.collapsed = props.collapsed;
      this.loaded ||= !this.collapsed;
    }
    return this.renderUpdate(changed);
  }

  toggle() {
    return this.collapsed ? this.expand() : this.collapse();
  }

  expand() {
    return this.setCollapsed(false);
  }

  collapse() {
    return this.setCollapsed(true);
  }

  setCollapsed(collapsed) {
    if (this.destroyed || this.collapsed === collapsed) return Promise.resolve();
    this.collapsed = collapsed;
    this.loaded ||= !collapsed;
    return this.renderUpdate(true);
  }

  renderUpdate(changed) {
    return etch.update(this).then(() => {
      if (changed && !this.destroyed) this.onDidExpandOrCollapseSection?.(this);
    });
  }

  destroy() {
    if (!this.destroyed) {
      this.destroyed = true;
      this.onDidExpandOrCollapseSection = null;
      this.children = [];
      this.destructionPromise = etch.destroy(this);
    }
    return this.destructionPromise;
  }
};
