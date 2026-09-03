/** @jsx etch.dom */
const etch = require("@lumine-code/etch");
const dedent = require("dedent");
const CodeBlock = require("./code-block");

module.exports = class ExampleSelectListView {
  constructor() {
    this.jsExampleCode = dedent`
    const selectListView = lumine.workspace.buildSelectList({
      items: ['one', 'two', 'three'],
      renderItem: (item) => ({ primary: item }),
      commands: {
        'example:confirm': {
          description: 'Confirm the selected example item.',
          didDispatch: (event) => console.log('confirmed', event.detail.item)
        }
      },
      actions: [{
        command: 'example:confirm',
        context: 'item',
        primary: true,
        disposition: 'close'
      }]
    })
    selectListView.onDidCancel(() => {
      console.log('cancelled')
    })
    selectListView.show()
    `;

    // The list is built rather than rendered as an etch component: the editor
    // hands back an instance, and etch needs a constructor in tag position. Its
    // element is adopted into the tree below instead.
    this.selectListView = lumine.workspace.buildSelectList({
      items: ["one", "two", "three"],
      // This is a static showcase, not a live picker in a fixed modal.
      // Leaving the selection empty avoids scrolling the whole styleguide to
      // this mid-page example.
      selection: { allowEmpty: true, initial: { mode: "none" } },
      renderItem: this.renderItem.bind(this),
      commands: {
        "styleguide:confirm-example-item": {
          description: "Confirm the selected example item.",
          didDispatch: (event) => this.confirmItem(event.detail.item),
        },
      },
      actions: [
        {
          command: "styleguide:confirm-example-item",
          context: "item",
          primary: true,
          disposition: "close",
        },
      ],
    });
    this.cancelSubscription = this.selectListView.onDidCancel(() => this.logCancellation());

    etch.initialize(this);
    this.refs.host.appendChild(this.selectListView.getElement());
  }

  renderItem(item) {
    return { primary: item };
  }

  confirmItem(item) {
    console.log("confirmed", item);
  }

  logCancellation() {
    console.log("cancelled");
  }

  render() {
    return (
      <div className="example">
        <div className="example-rendered">
          <lumine-panel className="modal" ref="host" />
        </div>
        <div className="example-code show-example-space-pen">
          <CodeBlock
            cssClass="example-space-pen"
            grammarScopeName="source.js"
            code={this.jsExampleCode}
          />
        </div>
      </div>
    );
  }

  update() {}

  destroy() {
    this.cancelSubscription.dispose();
    this.selectListView.destroy();
    return etch.destroy(this);
  }
};
