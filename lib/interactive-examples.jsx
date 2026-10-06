/** @jsx etch.dom */
const { CompositeDisposable } = require("lumine");
const etch = require("@lumine-code/etch");
const dedent = require("dedent");
const CodeBlock = require("./code-block");

class InputDialogExample {
  constructor({ onDidInitialize } = {}) {
    this.destroyed = false;
    this.code = dedent`
      const dialog = lumine.workspace.buildInputDialog({
        placeholderText: 'Example name',
        infoMessage: 'Enter a name, then submit it.',
        commands: {
          'styleguide:submit-example-name': {
            description: 'Submit the example name.',
            hiddenInCommandPalette: true,
            didDispatch: ({ detail }) => {
              const name = detail.query.trim()
              return detail.dialog.setStatus({
                type: name ? 'info' : 'error',
                message: name ? 'Submitted: ' + name + '.' : 'Enter a name.'
              })
            }
          }
        },
        actions: [{
          command: 'styleguide:submit-example-name',
          context: 'dialog',
          primary: true,
          disposition: 'stay'
        }]
      })
      preview.appendChild(dialog.getElement())
      submitButton.addEventListener('click', () => dialog.confirm())
      resetButton.addEventListener('click', () => {
        dialog.setQuery('')
        dialog.clearStatus()
      })
      // When removing the preview:
      await dialog.destroy()
    `;
    this.dialog = lumine.workspace.buildInputDialog({
      placeholderText: "Example name",
      infoMessage: "Enter a name, then submit it.",
      commands: {
        "styleguide:submit-example-name": {
          description: "Submit the example name.",
          hiddenInCommandPalette: true,
          didDispatch: ({ detail }) => {
            const name = detail.query.trim();
            return detail.dialog.setStatus({
              type: name ? "info" : "error",
              message: name ? `Submitted: ${name}.` : "Enter a name.",
            });
          },
        },
      },
      actions: [
        {
          command: "styleguide:submit-example-name",
          context: "dialog",
          primary: true,
          disposition: "stay",
        },
      ],
    });
    etch.initialize(this);
    this.refs.host.appendChild(this.dialog.getElement());
    onDidInitialize?.(this);
  }

  submit() {
    if (this.destroyed) return;
    return this.dialog.confirm();
  }

  reset() {
    if (this.destroyed) return;
    this.dialog.setQuery("");
    return this.dialog.clearStatus();
  }

  render() {
    return (
      <div className="example">
        <div className="example-rendered">
          <lumine-panel className="modal block" ref="host" />
          <div className="btn-group">
            <button className="btn btn-primary" type="button" onclick={() => this.submit()}>
              Submit
            </button>
            <button className="btn" type="button" onclick={() => this.reset()}>
              Reset
            </button>
          </div>
        </div>
        <div className="example-code">
          <CodeBlock cssClass="example-js" grammarScopeName="source.js" code={this.code} />
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
    this.destroyPromise = Promise.all([this.dialog.destroy(), etch.destroy(this)]);
    return this.destroyPromise;
  }
}

class MenuExample {
  constructor({ onDidInitialize } = {}) {
    this.destroyed = false;
    this.checked = true;
    this.popup = null;
    this.popupSubscription = null;
    this.code = dedent`
      const commands = lumine.commands.add(preview, {
        'styleguide:choose-menu-example': {
          description: 'Choose a menu example.',
          hiddenInCommandPalette: true,
          didDispatch: ({ detail }) => {
            status.textContent = 'Selected: ' + detail.label + '.'
          }
        },
        'styleguide:toggle-menu-example': {
          description: 'Toggle the menu example option.',
          hiddenInCommandPalette: true,
          didDispatch: () => {
            checked = !checked
            status.textContent = 'Example option: ' + (checked ? 'on.' : 'off.')
          }
        }
      })
      let checked = true
      let popup
      menuButton.addEventListener('click', () => {
        popup?.destroy()
        popup = lumine.menu.showPopup({
          anchor: menuButton,
          target: preview,
          template: [
            { label: 'Choose Alpha', command: 'styleguide:choose-menu-example', commandDetail: { label: 'Alpha' } },
            { label: 'More Choices', submenu: [
              { label: 'Choose Beta', command: 'styleguide:choose-menu-example', commandDetail: { label: 'Beta' } },
              { label: 'Unavailable Choice', enabled: false }
            ] },
            { type: 'separator' },
            { label: 'Example Option', type: 'checkbox', checked, command: 'styleguide:toggle-menu-example' }
          ]
        })
      })
      // When removing the preview:
      popup?.destroy()
      commands.dispose()
    `;
    etch.initialize(this);
    this.disposables = new CompositeDisposable(
      lumine.commands.add(this.element, {
        "styleguide:choose-menu-example": {
          description: "Choose a menu example.",
          hiddenInCommandPalette: true,
          didDispatch: ({ detail }) => this.setStatus(`Selected: ${detail.label}.`),
        },
        "styleguide:toggle-menu-example": {
          description: "Toggle the menu example option.",
          hiddenInCommandPalette: true,
          didDispatch: () => {
            this.checked = !this.checked;
            this.setStatus(`Example option: ${this.checked ? "on" : "off"}.`);
          },
        },
      }),
    );
    onDidInitialize?.(this);
  }

  setStatus(message) {
    if (!this.destroyed) this.refs.status.textContent = message;
  }

  showMenu() {
    if (this.destroyed) return;
    this.closeMenu();
    const popup = lumine.menu.showPopup({
      anchor: this.refs.trigger,
      target: this.element,
      template: [
        {
          label: "Choose Alpha",
          command: "styleguide:choose-menu-example",
          commandDetail: { label: "Alpha" },
        },
        {
          label: "More Choices",
          submenu: [
            {
              label: "Choose Beta",
              command: "styleguide:choose-menu-example",
              commandDetail: { label: "Beta" },
            },
            { label: "Unavailable Choice", enabled: false },
          ],
        },
        { type: "separator" },
        {
          label: "Example Option",
          type: "checkbox",
          checked: this.checked,
          command: "styleguide:toggle-menu-example",
        },
      ],
    });
    this.popup = popup;
    this.popupSubscription = popup.onDidClose(() => {
      if (this.popup === popup) {
        this.popup = null;
        this.popupSubscription?.dispose();
        this.popupSubscription = null;
      }
    });
    return popup;
  }

  closeMenu() {
    this.popupSubscription?.dispose();
    this.popupSubscription = null;
    const popup = this.popup;
    this.popup = null;
    popup?.destroy();
  }

  render() {
    return (
      <div className="example">
        <div className="example-rendered">
          <button ref="trigger" className="btn" type="button" onclick={() => this.showMenu()}>
            Open Example Menu
          </button>
          <p ref="status" className="text-subtle" role="status">
            Choose an item or toggle the example option.
          </p>
        </div>
        <div className="example-code">
          <CodeBlock cssClass="example-js" grammarScopeName="source.js" code={this.code} />
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
    this.closeMenu();
    this.disposables.dispose();
    this.destroyPromise = etch.destroy(this);
    return this.destroyPromise;
  }
}

class TooltipExample {
  constructor({ onDidInitialize } = {}) {
    this.destroyed = false;
    this.code = dedent`
      const tooltip = lumine.tooltips.add(tooltipButton, {
        title: 'A tooltip from the shared API.',
        trigger: 'click',
        placement: 'auto bottom'
      })
      const compositeTooltip = lumine.tooltips.addComposite(compositeButton, [
        {
          title: 'Open the command palette',
          keyBindingCommand: 'command-palette:toggle',
          keyBindingTarget: lumine.views.getView(lumine.workspace),
          trigger: 'click',
          placement: 'auto bottom'
        },
        { title: 'Additional action', keyBindingExtra: 'cmdorctrl+LMB' }
      ])
      // When removing the preview:
      tooltip.dispose()
      compositeTooltip.dispose()
    `;
    etch.initialize(this);
    this.disposables = new CompositeDisposable(
      lumine.tooltips.add(this.refs.single, {
        title: "A tooltip from the shared API.",
        trigger: "click",
        placement: "auto bottom",
      }),
      lumine.tooltips.addComposite(this.refs.composite, [
        {
          title: "Open the command palette",
          keyBindingCommand: "command-palette:toggle",
          keyBindingTarget: lumine.views.getView(lumine.workspace),
          trigger: "click",
          placement: "auto bottom",
        },
        { title: "Additional action", keyBindingExtra: "cmdorctrl+LMB" },
      ]),
    );
    onDidInitialize?.(this);
  }

  render() {
    return (
      <div className="example">
        <div className="example-rendered">
          <button ref="single" className="btn inline-block" type="button">
            Show Tooltip
          </button>
          <button ref="composite" className="btn" type="button">
            Show Composite Tooltip
          </button>
        </div>
        <div className="example-code">
          <CodeBlock cssClass="example-js" grammarScopeName="source.js" code={this.code} />
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
    this.disposables.dispose();
    this.destroyPromise = etch.destroy(this);
    return this.destroyPromise;
  }
}

module.exports = { InputDialogExample, MenuExample, TooltipExample };
