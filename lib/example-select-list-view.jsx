/** @jsx etch.dom */
const etch = require("@lumine-code/etch");
const dedent = require("dedent");
const CodeBlock = require("./code-block");

module.exports = class ExampleSelectListView {
  constructor({ onDidInitialize } = {}) {
    this.destroyed = false;
    this.jsExampleCode = dedent`
    const selectList = lumine.workspace.buildSelectList({
      items: ['one', 'two', 'three'],
      selection: { allowEmpty: true, initial: { mode: 'none' } },
      infoMessage: 'Select a row, then press Enter to confirm.',
      renderItem: (item) => ({ primary: item }),
      commands: {
        'styleguide:confirm-example-item': {
          description: 'Confirm the selected example item.',
          hiddenInCommandPalette: true,
          didDispatch: ({ detail }) => detail.dialog.setStatus({
            type: 'info',
            message: 'Selected: ' + detail.item + '.'
          })
        }
      },
      actions: [{
        command: 'styleguide:confirm-example-item',
        context: 'item',
        primary: true,
        disposition: 'stay'
      }]
    })
    preview.appendChild(selectList.getElement())
    // When removing the preview:
    await selectList.destroy()
    `;

    // The list is built rather than rendered as an etch component: the editor
    // hands back an instance, and etch needs a constructor in tag position. Its
    // element is adopted into the tree below instead.
    this.selectList = lumine.workspace.buildSelectList({
      items: ["one", "two", "three"],
      // This is a static showcase, not a live picker in a fixed modal.
      // Leaving the selection empty avoids scrolling the whole styleguide to
      // this mid-page example.
      selection: { allowEmpty: true, initial: { mode: "none" } },
      infoMessage: "Select a row, then press Enter to confirm.",
      renderItem: this.renderItem.bind(this),
      commands: {
        "styleguide:confirm-example-item": {
          description: "Confirm the selected example item.",
          hiddenInCommandPalette: true,
          didDispatch: (event) => this.confirmItem(event.detail.item),
        },
      },
      actions: [
        {
          command: "styleguide:confirm-example-item",
          context: "item",
          primary: true,
          disposition: "stay",
        },
      ],
    });
    etch.initialize(this);
    this.refs.host.appendChild(this.selectList.getElement());
    onDidInitialize?.(this);
  }

  renderItem(item) {
    return { primary: item };
  }

  confirmItem(item) {
    if (this.destroyed) return;
    return this.selectList.setStatus({ type: "info", message: `Selected: ${item}.` });
  }

  render() {
    return (
      <div className="example">
        <div className="example-rendered">
          <lumine-panel className="modal" ref="host" />
        </div>
        <div className="example-code">
          <CodeBlock cssClass="example-js" grammarScopeName="source.js" code={this.jsExampleCode} />
        </div>
      </div>
    );
  }

  update() {
    return Promise.resolve();
  }

  destroy() {
    if (this.destroyed) return this.destroyPromise;
    this.destroyed = true;
    this.destroyPromise = Promise.all([this.selectList.destroy(), etch.destroy(this)]);
    return this.destroyPromise;
  }
};
