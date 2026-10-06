/** @jsx etch.dom */
const { CompositeDisposable } = require("lumine");
const etch = require("@lumine-code/etch");
const dedent = require("dedent");
const CodeBlock = require("./code-block");
const HTMLExample = require("./html-example");
const StyleguideSection = require("./styleguide-section");
const ExampleSelectListView = require("./example-select-list-view");
const ICON_NAMES = require("./icon-names.json");
const { InputDialogExample, MenuExample, TooltipExample } = require("./interactive-examples");

class SelectBoxExample {
  constructor({ onDidInitialize } = {}) {
    this.destroyed = false;
    this.controller = lumine.menu.createSelectBox({
      className: "input-select",
      ariaLabel: "Example option",
      items: ["Option 1", "Option 2", "Option 3"],
      value: "Option 1",
    });
    etch.initialize(this);
    this.refs.rendered.appendChild(this.controller.element);
    onDidInitialize?.(this);
  }

  update() {
    return Promise.resolve();
  }

  render() {
    const code = dedent`
      const selectBox = lumine.menu.createSelectBox({
        items: ['Option 1', 'Option 2', 'Option 3'],
        value: 'Option 1'
      })
    `;
    return (
      <div className="example">
        <div ref="rendered" className="example-rendered" />
        <div className="example-code">
          <CodeBlock cssClass="example-js" grammarScopeName="source.js" code={code} />
        </div>
      </div>
    );
  }

  destroy() {
    if (this.destroyed) return this.destructionPromise;
    this.destroyed = true;
    this.controller.destroy();
    this.destructionPromise = etch.destroy(this);
    return this.destructionPromise;
  }
}

module.exports = class StyleguideView {
  constructor(props) {
    this.uri = props.uri;
    this.collapsedSections = props.collapsedSections ? new Set(props.collapsedSections) : new Set();
    this.sections = [];
    this.examples = new Set();
    this.themeVariables = lumine.themes.getVariables();
    etch.initialize(this);
    this.destroyed = false;
    this.resolvedValuesGeneration = 0;
    this.resolvedValuesFrame = null;
    this.connectionObserver = null;
    for (const section of this.sections) {
      if (this.collapsedSections.has(section.name)) {
        section.collapse();
      } else {
        section.expand();
      }
    }

    // Fill in the resolved value of every theme variable next to its swatch,
    // and keep it current as the active theme changes or sections expand.
    this.disposables = new CompositeDisposable();
    this.disposables.add(lumine.themes.onDidChangeVariables(() => this.scheduleResolvedValues()));
    this.scheduleResolvedValues();
  }

  destroy() {
    if (this.destroyed) return this.destructionPromise;
    this.destroyed = true;
    this.cancelResolvedValuesSchedule();
    this.disposables?.dispose();
    const destructions = this.sections.map((section) => section.destroy());
    destructions.push(...Array.from(this.examples, (example) => example.destroy()));
    this.examples.clear();
    destructions.push(etch.destroy(this));
    this.sections = [];
    this.destructionPromise = Promise.all(destructions);
    return this.destructionPromise;
  }

  cancelResolvedValuesSchedule() {
    this.resolvedValuesGeneration++;
    const frame = this.resolvedValuesFrame;
    this.resolvedValuesFrame = null;
    if (frame != null) cancelAnimationFrame(frame);
    this.disconnectConnectionObserver();
  }

  disconnectConnectionObserver(observer = this.connectionObserver) {
    if (this.connectionObserver === observer) this.connectionObserver = null;
    observer?.disconnect();
  }

  scheduleResolvedValues() {
    if (this.destroyed || !this.element) return;
    this.cancelResolvedValuesSchedule();
    this.scheduleResolvedValuesForGeneration(this.resolvedValuesGeneration);
  }

  scheduleResolvedValuesForGeneration(generation) {
    if (this.destroyed || generation !== this.resolvedValuesGeneration) return;
    if (!this.element.isConnected) {
      this.waitForConnection(generation);
      return;
    }

    let frame;
    frame = requestAnimationFrame(() => {
      if (
        this.destroyed ||
        generation !== this.resolvedValuesGeneration ||
        this.resolvedValuesFrame !== frame
      ) {
        return;
      }
      this.resolvedValuesFrame = null;
      if (!this.element.isConnected) {
        this.scheduleResolvedValuesForGeneration(generation);
        return;
      }
      this.updateResolvedValues();
    });
    this.resolvedValuesFrame = frame;
  }

  waitForConnection(generation) {
    let observer;
    const finish = () => {
      if (
        this.destroyed ||
        generation !== this.resolvedValuesGeneration ||
        this.connectionObserver !== observer
      ) {
        this.disconnectConnectionObserver(observer);
        return;
      }
      if (this.element.isConnected) {
        this.disconnectConnectionObserver(observer);
        this.scheduleResolvedValuesForGeneration(generation);
      }
    };
    observer = new MutationObserver(finish);
    this.connectionObserver = observer;
    observer.observe(document, { childList: true, subtree: true });
    finish();
  }

  serialize() {
    return {
      deserializer: this.constructor.name,
      collapsedSections: this.sections.filter((s) => s.collapsed).map((s) => s.name),
      uri: this.uri,
    };
  }

  update() {
    return Promise.resolve();
  }

  getURI() {
    return this.uri;
  }

  getTitle() {
    return "Styleguide";
  }

  getIconName() {
    return "paintcan";
  }

  expandAll() {
    return Promise.all(this.sections.map((section) => section.expand()));
  }

  collapseAll() {
    return Promise.all(this.sections.map((section) => section.collapse()));
  }

  render() {
    return (
      <div className="styleguide pane-item native-key-bindings" tabIndex="-1">
        <header className="styleguide-header">
          <div className="styleguide-intro">
            <h1>Styleguide</h1>
            <p>Explore the editor's components and theme variables.</p>
          </div>

          <div className="styleguide-controls btn-group">
            <button type="button" className="btn" onclick={() => this.collapseAll()}>
              Collapse All
            </button>
            <button type="button" className="btn" onclick={() => this.expandAll()}>
              Expand All
            </button>
          </div>
        </header>

        <main className="styleguide-sections">
          <StyleguideSection
            onDidInitialize={this.didInitializeSection.bind(this)}
            name="variables"
            title="Variables"
          >
            <p>
              Use these CSS custom properties in your stylesheets, for example{" "}
              <code>color: var(--text-color);</code>. The tables show their current resolved values,
              with color previews and descriptions.
            </p>

            {this.renderVariableGroups()}
          </StyleguideSection>

          <StyleguideSection
            onDidInitialize={this.didInitializeSection.bind(this)}
            name="authoring-themes"
            title="Authoring themes"
          >
            <p>
              A theme sets the variables above. Themes come in two types &mdash; a <code>ui</code>{" "}
              theme styles the chrome (docks, tabs, panels) and a <code>syntax</code> theme styles
              the editor &mdash; and the two are chosen independently, so a UI theme can pair with
              any syntax theme.
            </p>

            <h3>The palette</h3>
            <p>
              A theme defines its palette as CSS custom properties in a <code>variables.css</code>{" "}
              file. Color values must resolve to colors usable by CSS relative-color functions and
              <code>color-mix()</code>:
            </p>
            <div className="example">
              <div className="example-code">
                <CodeBlock
                  cssClass="example-css"
                  grammarScopeName="source.css"
                  code={dedent`
                    :root {
                      --text-color: hsl(220, 13%, 66%);
                      --base-background-color: hsl(220, 13%, 18%);
                      --accent-indicator-color: hsl(220, 100%, 66%);
                      /* ...the rest of the contract... */
                    }
                  `}
                />
              </div>
            </div>

            <p>
              Set theme inputs on <code>:root</code>. Derived values that refer to other variables
              resolve there; changing an input only within a descendant does not recompute an
              inherited derived value. Editor typography comes from the editor's settings on
              <code>lumine-workspace</code>.
            </p>

            <h3>One package, several themes</h3>
            <p>
              A single package can ship several selectable themes with a <code>themes</code> array
              in its <code>package.json</code>. Each entry names the theme, its type, and the
              directory holding its styles (a list of directories may be given to share a common
              base):
            </p>
            <div className="example">
              <div className="example-code">
                <CodeBlock
                  cssClass="example-css"
                  grammarScopeName="source.json"
                  code={dedent`
                    {
                      "name": "one-theme",
                      "themes": [
                        { "name": "one-day-ui", "theme": "ui", "styles": ["styles/ui", "styles/day-ui"] },
                        { "name": "one-day-syntax", "theme": "syntax", "styles": ["styles/syntax", "styles/day-syntax"] },
                        { "name": "one-night-ui", "theme": "ui", "styles": ["styles/ui", "styles/night-ui"] },
                        { "name": "one-night-syntax", "theme": "syntax", "styles": ["styles/syntax", "styles/night-syntax"] }
                      ]
                    }
                  `}
                />
              </div>
            </div>
            <p>
              A single-theme package instead uses a top-level <code>"theme": "ui"</code> (or{" "}
              <code>"syntax"</code>) and puts its stylesheets in <code>styles/</code>. Every
              stylesheet of a syntax theme receives editor-context metadata, but that metadata does
              not rewrite its selectors. Define palette variables on <code>:root</code> and scope
              highlighting rules explicitly under <code>lumine-text-editor</code>. File names are
              free — split the rules across as many as reads well, and number them, since they load
              in name order and later rules win.
            </p>
            <p>
              Keep palette declarations in <code>variables.css</code> so core can identify them; it
              warns when this file is absent. Variables the active theme pair does not define use
              core's fallback values. A theme that changes only part of another palette can inherit
              its styles with a package-qualified <code>extends</code> glob. The inherited styles
              load before the theme's own files.
            </p>
            <div className="example">
              <div className="example-code">
                <CodeBlock
                  cssClass="example-json"
                  grammarScopeName="source.json"
                  code={dedent`
                    {
                      "name": "custom-theme",
                      "themes": [{
                        "name": "custom-ui",
                        "theme": "ui",
                        "extends": "one-theme::styles/ui/**/*.css",
                        "styles": ["styles/custom-ui"]
                      }]
                    }
                  `}
                />
              </div>
            </div>
          </StyleguideSection>

          <StyleguideSection
            onDidInitialize={this.didInitializeSection.bind(this)}
            name="icons"
            title="Icons"
          >
            <p>Use the bundled icons beside labels, in buttons and in lists.</p>
            <p>
              Add <code>icon</code> and <code>icon-&lt;name&gt;</code> to the element's classes.
              Symbol icons describe the kinds of entries in a code outline.
            </p>

            {this.renderIconGallery(
              "Octicons",
              ICON_NAMES.filter((name) => !name.startsWith("type-")),
            )}
            {this.renderIconGallery(
              "Symbol icons",
              ICON_NAMES.filter((name) => name.startsWith("type-")),
            )}
          </StyleguideSection>

          <StyleguideSection
            onDidInitialize={this.didInitializeSection.bind(this)}
            name="inputs"
            title="Inputs"
          >
            <p>Various inputs and controls.</p>

            <h3>Text Inputs</h3>
            {this.renderExampleHTML(dedent`
              <input class='input-text' type='text' placeholder='Text' aria-label='Example text'>
              <input class='input-search' type='search' placeholder='Search' aria-label='Example search'>
              <textarea class='input-textarea' placeholder='Text Area' aria-label='Example multiline text'></textarea>
              <input class='input-text' type='text' value='Read-only text' readonly aria-label='Read-only example'>
              <input class='input-text' type='text' value='Disabled text' disabled aria-label='Disabled example'>
            `)}

            <h3>Controls</h3>
            {this.renderExampleHTML(dedent`
              <form>
                <label class='input-label'><input class='input-radio' type='radio' name='radio'> Radio</label>
                <label class='input-label'><input class='input-radio' type='radio' name='radio' checked> Selected Radio</label>
                <label class='input-label'><input class='input-checkbox' type='checkbox' checked> Checkbox</label>
                <label class='input-label'><input class='input-checkbox' type='checkbox' disabled> Disabled Checkbox</label>
                <label class='input-label'><input class='input-toggle' type='checkbox' checked> Toggle</label>
                <input class='input-range' type='range' aria-label='Example range'>
              </form>
            `)}

            <h3>Misc</h3>
            {this.renderExampleHTML(dedent`
              <input class='input-color' type='color' value='#FF85FF' aria-label='Example color'>
              <input class='input-number' type='number' min='1' max='10' placeholder='1-10' aria-label='Example number'>
            `)}
            <SelectBoxExample onDidInitialize={this.didInitializeExample.bind(this)} />
          </StyleguideSection>

          <StyleguideSection
            onDidInitialize={this.didInitializeSection.bind(this)}
            name="text"
            title="Text"
          >
            <p>There are a number of text classes.</p>

            <h3>text-* classes</h3>
            {this.renderExampleHTML(dedent`
              <div class='text-smaller'>Smaller text</div>
              <div>Normal text</div>
              <div class='text-subtle'>Subtle text</div>
              <div class='text-primary'>Primary text</div>
              <div class='text-highlight'>Highlighted text</div>
              <div class='text-info'>Info text</div>
              <div class='text-success'>Success text</div>
              <div class='text-warning'>Warning text</div>
              <div class='text-error'>Error text</div>
              <div>Character <span class='character-match'>match</span></div>
            `)}

            <h3>highlight-* classes</h3>
            {this.renderExampleHTML(dedent`
              <span class='inline-block'>Normal</span>
              <span class='inline-block highlight'>Highlighted</span>
              <span class='inline-block highlight-info'>Info</span>
              <span class='inline-block highlight-success'>Success</span>
              <span class='inline-block highlight-warning'>Warning</span>
              <span class='inline-block highlight-error'>Error</span>
            `)}
          </StyleguideSection>

          <StyleguideSection
            onDidInitialize={this.didInitializeSection.bind(this)}
            name="layout"
            title="Layout"
          >
            <p>A few things that might be useful for general layout.</p>

            <h3>.block</h3>
            <p>Sometimes you need to separate components vertically. Say in a form.</p>
            {this.renderExampleHTML(dedent`
              <div class='block'>
                <label>You might want to type something here.</label>
                <lumine-text-editor mini>Something you typed.</lumine-text-editor>
              </div>
              <div class='block'>
                <label class='icon icon-file-directory'>Another field with an icon</label>
                <lumine-text-editor mini>Something else you typed.</lumine-text-editor>
              </div>
              <div class='block'>
                <button class='btn'>Do it</button>
              </div>
            `)}

            <h3>.inline-block</h3>
            <p>Sometimes you need to separate components horizontally.</p>
            {this.renderExampleHTML(dedent`
              <div class='block'>
                <button class='inline-block btn'>Do it</button>
                <button class='inline-block btn'>Another</button>
                <button class='inline-block btn'>More</button>
              </div>
            `)}

            <h3>.inline-block-tight</h3>
            <p>You might want things to be a little closer to each other.</p>
            {this.renderExampleHTML(dedent`
              <div class='block'>
                <button class='inline-block-tight btn'>Do it</button>
                <button class='inline-block-tight btn'>Another</button>
                <button class='inline-block-tight btn'>More</button>
              </div>
            `)}
          </StyleguideSection>

          <StyleguideSection
            onDidInitialize={this.didInitializeSection.bind(this)}
            name="git"
            title="Git Status"
          >
            <p>Often we need git related classes to specify status.</p>

            <h3>status-* classes</h3>
            {this.renderExampleHTML(dedent`
              <div class='status-ignored'>Ignored</div>
              <div class='status-added'>Added</div>
              <div class='status-modified'>Modified</div>
              <div class='status-removed'>Removed</div>
              <div class='status-renamed'>Renamed</div>
            `)}

            <h3>status-* classes with related icons</h3>
            {this.renderExampleHTML(dedent`
              <span class='inline-block status-ignored icon icon-diff-ignored'></span>
              <span class='inline-block status-added icon icon-diff-added'></span>
              <span class='inline-block status-modified icon icon-diff-modified'></span>
              <span class='inline-block status-removed icon icon-diff-removed'></span>
              <span class='inline-block status-renamed icon icon-diff-renamed'></span>
            `)}
          </StyleguideSection>

          <StyleguideSection
            onDidInitialize={this.didInitializeSection.bind(this)}
            name="category-colors"
            title="Category colors"
          >
            <p>Category colors distinguish related items in multicolor indicators.</p>

            <h3>ui-site-* classes</h3>
            <p>
              These classes only set the background color, no other styles. You can also use the CSS
              custom properties <code>var(--ui-site-color-#)</code> in your packages where{" "}
              <code>#</code> is a number between 1 and 5.
            </p>
            <p>The active theme supplies all five colors.</p>
            {this.renderExampleHTML(dedent`
              <div class='block ui-site-1'></div>
              <div class='block ui-site-2'></div>
              <div class='block ui-site-3'></div>
              <div class='block ui-site-4'></div>
              <div class='block ui-site-5'></div>
            `)}
          </StyleguideSection>

          <StyleguideSection
            onDidInitialize={this.didInitializeSection.bind(this)}
            name="badges"
            title="Badges"
          >
            <p>Badges are typically used to show numbers.</p>

            <h3>Standalone badges</h3>
            {this.renderExampleHTML(dedent`
              <div class='block'>
                <span class='badge'>0</span>
                <span class='badge'>8</span>
                <span class='badge'>27</span>
                <span class='badge'>450</span>
                <span class='badge'>2869</span>
              </div>
            `)}

            <h3>Colored badges</h3>
            {this.renderExampleHTML(dedent`
              <div class='block'>
                <span class='badge badge-info'>78</span>
                <span class='badge badge-success'>3</span>
                <span class='badge badge-warning'>14</span>
                <span class='badge badge-error'>1845</span>
              </div>
            `)}

            <h3>Badge sizes</h3>
            <p>
              By default the <code>--ui-font-size</code> variable from themes is used. Additionally
              there are also 3 predefined sizes.
            </p>
            {this.renderExampleHTML(dedent`
              <div class='block'>Large <span class='badge badge-large'>8</span></div>
              <div class='block'>Medium <span class='badge badge-medium'>2</span></div>
              <div class='block'>Small <span class='badge badge-small'>7</span></div>
            `)}

            <p>
              If you like the size change depending on the parent, use the{" "}
              <code>badge-flexible</code> class. Note: Best used for larger sizes. For smaller sizes
              it could cause the number to be mis-aligned by a pixel.
            </p>
            {this.renderExampleHTML(dedent`
              <h1 class='block'>Heading <span class='badge badge-flexible'>1</span></h1>
              <h2 class='block'>Heading <span class='badge badge-flexible'>2</span></h2>
              <h3 class='block'>Heading <span class='badge badge-flexible'>3</span></h3>
            `)}

            <h3>Icon Badges</h3>
            <p>See the icons section to get an overview of all Octicons.</p>
            {this.renderExampleHTML(dedent`
              <div class='block'>
                <span class='badge icon icon-gear'>4</span>
                <span class='badge badge-info icon icon-cloud-download'>13</span>
                <span class='badge badge-success icon icon-octoface'>5</span>
              </div>
            `)}
          </StyleguideSection>

          <StyleguideSection
            onDidInitialize={this.didInitializeSection.bind(this)}
            name="buttons"
            title="Buttons"
          >
            <p>Use buttons for actions, with a selected or disabled state where appropriate.</p>

            <h3>Standalone buttons</h3>
            {this.renderExampleHTML(dedent`
              <div class='block'>
                <button class='btn'>Button</button>
              </div>
              <div class='block'>
                <button class='btn btn-xs'>Extra Small Button</button>
              </div>
              <div class='block'>
                <button class='btn btn-sm'>Small Button</button>
              </div>
              <div class='block'>
                <button class='btn btn-lg'>Large Button</button>
              </div>
              <div class='block'>
                <button class='btn' disabled>Disabled Button</button>
              </div>
            `)}

            <h3>Colored buttons</h3>
            {this.renderExampleHTML(dedent`
              <div class='block'>
                <button class='btn btn-primary inline-block-tight'>Primary</button>
                <button class='btn btn-primary selected inline-block-tight'>Selected Primary</button>
              </div>

              <div class='block'>
                <button class='btn btn-info inline-block-tight'>Info</button>
                <button class='btn btn-info selected inline-block-tight'>Selected Info</button>
              </div>

              <div class='block'>
                <button class='btn btn-success inline-block-tight'>Success</button>
                <button class='btn btn-success selected inline-block-tight'>Selected Success</button>
              </div>

              <div class='block'>
                <button class='btn btn-warning inline-block-tight'>Warning</button>
                <button class='btn btn-warning selected inline-block-tight'>Selected Warning</button>
              </div>

              <div class='block'>
                <button class='btn btn-error inline-block-tight'>Error</button>
                <button class='btn btn-error selected inline-block-tight'>Selected Error</button>
              </div>
            `)}

            <h3>Icon buttons</h3>
            <p>Add an icon before the button's label.</p>
            {this.renderExampleHTML(dedent`
              <div class='block'>
                <button class='btn icon icon-gear inline-block-tight'>Settings</button>
                <button class='btn btn-primary icon icon-cloud-download inline-block-tight'>Install</button>
                <button class='btn btn-error icon icon-octoface inline-block-tight'>Danger</button>
              </div>
            `)}

            <h3>Button Groups</h3>
            {this.renderExampleHTML(dedent`
              <div class='block'>
                <div>Normal size</div>
                <div class='btn-group'>
                  <button class='btn'>One</button>
                  <button class='btn'>Two</button>
                  <button class='btn'>Three</button>
                </div>
              </div>

              <div class='block'>
                <div>Extra Small</div>
                <div class='btn-group btn-group-xs'>
                  <button class='btn'>One</button>
                  <button class='btn'>Two</button>
                  <button class='btn'>Three</button>
                </div>
              </div>

              <div class='block'>
                <div>Small</div>
                <div class='btn-group btn-group-sm'>
                  <button class='btn'>One</button>
                  <button class='btn'>Two</button>
                  <button class='btn'>Three</button>
                </div>
              </div>

              <div class='block'>
                <div>Large</div>
                <div class='btn-group btn-group-lg'>
                  <button class='btn'>One</button>
                  <button class='btn'>Two</button>
                  <button class='btn'>Three</button>
                </div>
              </div>
            `)}

            <h3>Button Toolbars</h3>
            {this.renderExampleHTML(dedent`
              <div class='btn-toolbar'>
                <div class='btn-group'>
                  <button class='btn'>One</button>
                  <button class='btn'>Two</button>
                  <button class='btn'>Three</button>
                </div>

                <div class='btn-group'>
                  <button class='btn'>Four</button>
                  <button class='btn'>Five</button>
                </div>

                <button class='btn'>Six</button>
                <button class='btn'>Seven</button>
              </div>
            `)}

            <h3>Selected buttons</h3>
            <p>
              Buttons can be marked selected by adding a <code>.selected</code> class. Useful for
              toggle groups.
            </p>
            {this.renderExampleHTML(dedent`
              <div class='block'>
                <div class='btn-group'>
                  <button class='btn selected'>One</button>
                  <button class='btn'>Two</button>
                  <button class='btn'>Three</button>
                </div>
              </div>

              <div class='block'>
                <div class='btn-group'>
                  <button class='btn'>One</button>
                  <button class='btn selected'>Two</button>
                  <button class='btn'>Three</button>
                </div>
              </div>

              <div class='block'>
                <div class='btn-group'>
                  <button class='btn'>One</button>
                  <button class='btn'>Two</button>
                  <button class='btn selected'>Three</button>
                </div>
              </div>

              <div class='block'>
                <div class='btn-group'>
                  <button class='btn selected'>One</button>
                  <button class='btn selected'>Two</button>
                  <button class='btn'>Three</button>
                </div>
              </div>
            `)}
          </StyleguideSection>

          <StyleguideSection
            onDidInitialize={this.didInitializeSection.bind(this)}
            name="panel"
            title="Panels"
          >
            <p>A container attached to some side of the Lumine UI.</p>
            {this.renderExampleHTML(dedent`
              <lumine-panel>
                Some content
              </lumine-panel>
            `)}

            <h3>Inset Panel</h3>
            <p>Use an inset panel to group related content within a panel.</p>
            {this.renderExampleHTML(dedent`
              <lumine-panel class='padded'>
                <div class="inset-panel padded">Some inset content</div>
              </lumine-panel>
            `)}

            <h3>With a heading</h3>
            {this.renderExampleHTML(dedent`
              <lumine-panel class='padded'>
                <div class="inset-panel">
                  <div class="panel-heading">An inset-panel heading</div>
                  <div class="panel-body padded">Some Content</div>
                </div>
              </lumine-panel>
            `)}
          </StyleguideSection>

          <StyleguideSection
            onDidInitialize={this.didInitializeSection.bind(this)}
            name="list-group"
            title="List Group"
          >
            <p>Use for anything that requires a list.</p>
            {this.renderExampleHTML(dedent`
              <ul class='list-group'>
                <li class='list-item'><span>Normal item</span></li>
                <li class='list-item selected'><span>This is the Selected item</span></li>
                <li class='list-item text-subtle'><span>Subtle</span></li>
                <li class='list-item text-info'><span>Info</span></li>
                <li class='list-item text-success'><span>Success</span></li>
                <li class='list-item text-warning'><span>Warning</span></li>
                <li class='list-item text-error'><span>Error</span></li>
              </ul>
            `)}

            <h3>With icons</h3>
            {this.renderExampleHTML(dedent`
              <ul class='list-group'>
                <li class='list-item'>
                  <span class='icon icon-file-directory'>Using a span with an icon</span>
                </li>
                <li class='list-item'>
                  <i class='icon icon-file-directory'></i>
                  <span>With .icon-file-directory using &lt;i&gt; tags</span>
                </li>
                <li class='list-item selected'>
                  <span class='icon icon-file-directory'>Selected with .icon-file-directory</span>
                </li>
                <li class='list-item'>
                  <span class='no-icon'>With .no-icon</span>
                </li>
                <li class='list-item'>
                  <span class='icon icon-file-text'>With icon-file-text</span>
                </li>
                <li class='list-item'>
                  <span class='icon icon-file-media'>With icon-file-media</span>
                </li>
                <li class='list-item'>
                  <span class='icon icon-file-symlink-file'>With icon-file-symlink-file</span>
                </li>
                <li class='list-item'>
                  <span class='icon icon-file-submodule'>With icon-file-submodule</span>
                </li>
                <li class='list-item'>
                  <span class='icon icon-book'>With icon-book</span>
                </li>
              </ul>
            `)}
          </StyleguideSection>

          <StyleguideSection
            onDidInitialize={this.didInitializeSection.bind(this)}
            name="list-tree"
            title="List Tree"
          >
            <p>
              A <code>.list-tree</code> is a special case of <code>.list-group</code>.
            </p>
            {this.renderExampleHTML(dedent`
              <ul class='list-tree'>
                <li class='list-nested-item'>
                  <div class='list-item'>
                    <span class='icon icon-file-directory'>A Directory</span>
                  </div>

                  <ul class='list-tree'>
                    <li class='list-nested-item'>
                      <div class='list-item'>
                        <span class='icon icon-file-directory'>Nested Directory</span>
                      </div>

                      <ul class='list-tree'>
                        <li class='list-item'>
                          <span class='icon icon-file-text'>File one</span>
                        </li>
                      </ul>
                    </li>

                    <li class='list-nested-item'>
                      <div class='list-item'>
                        <span class='icon icon-file-directory'>Another Nested Directory</span>
                      </div>

                      <ul class='list-tree'>
                        <li class='list-item'>
                          <span class='icon icon-file-text'>File one</span>
                        </li>
                      </ul>
                    </li>

                    <li class='list-item'>
                      <span class='icon icon-file-text'>File one</span>
                    </li>

                    <li class='list-item selected'>
                      <span class='icon icon-file-text'>File three .selected!</span>
                    </li>
                  </ul>
                </li>

                <li class='list-item'>
                  <span class='icon icon-file-text'>.icon-file-text</span>
                </li>

                <li class='list-item'>
                  <span class='icon icon-file-symlink-file'>.icon-file-symlink-file</span>
                </li>
              </ul>
            `)}

            <h3>With disclosure arrows</h3>
            <p>
              Add the class <code>.has-collapsable-children</code> to give the children with nested
              items disclosure arrows.
            </p>
            {this.renderExampleHTML(dedent`
              <ul class='list-tree has-collapsable-children'>
                <li class='list-nested-item'>
                  <div class='list-item'>
                    <span class='icon icon-file-directory'>A Directory</span>
                  </div>

                  <ul class='list-tree'>
                    <li class='list-nested-item'>
                      <div class='list-item'>
                        <span class='icon icon-file-directory'>Nested Directory</span>
                      </div>

                      <ul class='list-tree'>
                        <li class='list-item'>
                          <span class='icon icon-file-text'>File one</span>
                        </li>
                      </ul>
                    </li>

                    <li class='list-nested-item collapsed'>
                      <div class='list-item'>
                        <span class='icon icon-file-directory'>Collapsed Nested Directory</span>
                      </div>

                      <ul class='list-tree'>
                        <li class='list-item'>
                          <span class='icon icon-file-text'>File one</span>
                        </li>
                      </ul>
                    </li>

                    <li class='list-item'>
                      <span class='icon icon-file-text'>File one</span>
                    </li>

                    <li class='list-item selected'>
                      <span class='icon icon-file-text'>File three .selected!</span>
                    </li>
                  </ul>
                </li>

                <li class='list-item'>
                  <span class='icon icon-file-text'>.icon-file-text</span>
                </li>

                <li class='list-item'>
                  <span class='icon icon-file-symlink-file'>.icon-file-symlink-file</span>
                </li>
              </ul>
            `)}

            <h3>With disclosure arrows at only one level.</h3>
            <p>
              Add the class <code>.has-flat-children</code> to sub-<code>.list-tree</code>s to
              indicate that the children will not be collapsable.
            </p>
            {this.renderExampleHTML(dedent`
              <ul class='list-tree has-collapsable-children '>
                <li class='list-nested-item'>
                  <div class='list-item'>
                    <span class='icon icon-file-text'>This is a collapsable section</span>
                  </div>

                  <ul class='list-tree has-flat-children'>
                    <li class='list-item'>Something is here</li>
                    <li class='list-item selected'>Something selected</li>
                  </ul>
                </li>

                <li class='list-nested-item'>
                  <div class='list-item'>
                    <span class='icon icon-file-directory'>Another collapsable section</span>
                  </div>

                  <ul class='list-tree has-flat-children'>
                    <li class='list-item'>Something is here</li>
                    <li class='list-item'>Something else</li>
                  </ul>
                </li>
              </ul>
            `)}
          </StyleguideSection>

          <StyleguideSection
            onDidInitialize={this.didInitializeSection.bind(this)}
            name="input-dialog"
            title="Input Dialog"
          >
            <p>
              Use an input dialog for a prompt with validation and a status line. This inline
              example uses the same model as a modal hosted by <code>addInputDialog()</code>.
            </p>
            <InputDialogExample onDidInitialize={this.didInitializeExample.bind(this)} />
          </StyleguideSection>

          <StyleguideSection
            onDidInitialize={this.didInitializeSection.bind(this)}
            name="select-list"
            title="Select List"
          >
            <p>
              This is how you will typically specify a <code>.select-list</code>.
            </p>
            <ExampleSelectListView onDidInitialize={this.didInitializeExample.bind(this)} />

            <p>
              The list items have many options you can use, and shows you how they will display.
            </p>

            <h3>Basic example with one item selected</h3>
            {this.renderExampleHTML(dedent`
              <lumine-panel class='modal'>
                <div class='select-list'>
                  <ol class='list-group'>
                    <li class='selected'>one</li>
                    <li>two</li>
                    <li>three</li>
                  </ol>
                </div>
              </lumine-panel>
            `)}

            <h3>Single line with icons</h3>
            {this.renderExampleHTML(dedent`
              <lumine-panel class='modal'>
                <div class='select-list'>
                  <ol class='list-group'>
                    <li class='selected'>
                      <div class='status status-added icon icon-diff-added'></div>
                      <div class='icon icon-file-text'>Some file</div>
                    </li>

                    <li>
                      <div class='status status-modified icon icon-diff-modified'></div>
                      <div class='icon icon-file-text'>Another file</div>
                    </li>

                    <li>
                      <div class='status status-removed icon icon-diff-removed'></div>
                      <div class='icon icon-file-text'>Yet another file</div>
                    </li>
                  </ol>
                </div>
              </lumine-panel>
            `)}

            <h3>Trailing details and separators</h3>
            <p>
              Place secondary details in a <code>trailing-block</code> within the primary line. A
              separator is a non-interactive list row with <code>role='separator'</code>.
            </p>
            {this.renderExampleHTML(dedent`
              <lumine-panel class='modal'>
                <div class='select-list'>
                  <ol class='list-group'>
                    <li class='selected'>
                      <div class='primary-line'>
                        <div class='trailing-block'><span class='badge'>3</span><kbd class='key-binding'>Enter</kbd></div>
                        <span class='icon icon-file-text'>Some file</span>
                      </div>
                    </li>
                    <li class='select-list-separator' role='separator'></li>
                    <li>
                      <div class='primary-line'>
                        <div class='trailing-block'><span class='text-subtle'>Details</span><kbd class='key-binding'>Tab</kbd></div>
                        <span class='icon icon-file-text'>Another file</span>
                      </div>
                    </li>
                  </ol>
                </div>
              </lumine-panel>
            `)}

            <h3>Multiple lines with no icons</h3>
            {this.renderExampleHTML(dedent`
              <lumine-panel class='modal'>
                <div class='select-list'>
                  <ol class='list-group'>
                    <li class='two-lines'>
                      <div class='primary-line'>Primary line</div>
                      <div class='secondary-line'>Secondary line</div>
                    </li>

                    <li class='two-lines selected'>
                      <div class='primary-line'>A thing</div>
                      <div class='secondary-line'>Description of the thing</div>
                    </li>
                  </ol>
                </div>
              </lumine-panel>
            `)}

            <h3>Multiple lines with icons</h3>
            {this.renderExampleHTML(dedent`
              <lumine-panel class='modal'>
                <div class='select-list'>
                  <ol class='list-group'>
                    <li class='two-lines'>
                      <div class='status status-added icon icon-diff-added'></div>
                      <div class='primary-line icon icon-file-text'>Primary line</div>
                      <div class='secondary-line no-icon'>Secondary line</div>
                    </li>

                    <li class='two-lines selected'>
                      <div class='status status-modified icon icon-diff-modified'></div>
                      <div class='primary-line icon icon-file-symlink-file'>A thing</div>
                      <div class='secondary-line no-icon'>Description of the thing</div>
                    </li>

                    <li class='two-lines'>
                      <div class='status status-renamed icon icon-diff-renamed'></div>
                      <div class='primary-line icon icon-file-symlink-file'>A thing</div>
                      <div class='secondary-line no-icon'>Description of the thing</div>
                    </li>
                  </ol>
                </div>
              </lumine-panel>
            `)}

            <h3>Using mark-active class to indicate the active item</h3>
            <p>
              A selected row is the current navigation target; an active row marks an item already
              in use. The <code>auto-selected</code> class marks a selection suggested by the list.
            </p>
            {this.renderExampleHTML(dedent`
              <lumine-panel class='modal'>
                <div class='select-list'>
                  <ol class='list-group mark-active'>
                    <li class='selected'>Selected &mdash; user is arrowing through the list.</li>
                    <li class='active'>This is the active item</li>
                    <li class='selected active'>Selected and active</li>
                    <li class='selected auto-selected'>Suggested selection</li>
                  </ol>
                </div>
              </lumine-panel>
            `)}

            <h3>Error messages</h3>
            {this.renderExampleHTML(dedent`
              <lumine-panel class='modal'>
                <div class='select-list input-dialog'>
                  <lumine-text-editor mini>I searched for this</lumine-text-editor>
                  <div class='message-line status-message text-error' role='alert'>No matching items.</div>
                </div>
              </lumine-panel>
            `)}

            <h3>Information messages</h3>
            {this.renderExampleHTML(dedent`
              <lumine-panel class='modal'>
                <div class='select-list input-dialog'>
                  <lumine-text-editor mini placeholder-text='Search items'></lumine-text-editor>
                  <div class='message-line info-message' role='status'>Choose a matching item.</div>
                </div>
              </lumine-panel>
            `)}

            <h3>Loading message</h3>
            {this.renderExampleHTML(dedent`
              <lumine-panel class='modal'>
                <div class='select-list input-dialog'>
                  <lumine-text-editor mini>User input</lumine-text-editor>
                  <div class='message-line loading' role='status'>
                    <span class='loading loading-spinner-tiny'></span>
                    <span class='loading-message'>Loading results…</span>
                    <span class='badge'>1234</span>
                  </div>
                </div>
              </lumine-panel>
            `)}
          </StyleguideSection>

          <StyleguideSection
            onDidInitialize={this.didInitializeSection.bind(this)}
            name="popover-list"
            title="Popover List"
          >
            <p>
              A <code>.popover-list</code> is a <code>.select-list</code> that is meant to popover
              the code for something like autocomplete.
            </p>

            <h3>Basic example with one item selected</h3>
            {this.renderExampleHTML(dedent`
              <div class='select-list popover-list'>
                <lumine-text-editor mini>'User types here..'</lumine-text-editor>
                <ol class='list-group'>
                  <li class='selected'>one</li>
                  <li>two</li>
                  <li>three</li>
                </ol>
              </div>
            `)}
          </StyleguideSection>

          <StyleguideSection
            onDidInitialize={this.didInitializeSection.bind(this)}
            name="modal-panel"
            title="Modals"
          >
            <p>Modals are like dialog boxes.</p>
            {this.renderExampleHTML(dedent`
              <lumine-panel class='modal'>
                <div>Some content</div>
              </lumine-panel>
            `)}
          </StyleguideSection>

          <StyleguideSection
            onDidInitialize={this.didInitializeSection.bind(this)}
            name="menus"
            title="Menus"
          >
            <p>
              Use <code>lumine.menu.showPopup()</code> for a command menu anchored to a control. The
              popup follows the active theme and supports keyboard navigation.
            </p>
            <MenuExample onDidInitialize={this.didInitializeExample.bind(this)} />
          </StyleguideSection>

          <StyleguideSection
            onDidInitialize={this.didInitializeSection.bind(this)}
            name="tooltips"
            title="Tooltips"
          >
            <p>
              Register a tooltip with <code>lumine.tooltips.add()</code> and dispose it when its
              control is removed. Use <code>keyBindingCommand</code> and{" "}
              <code>keyBindingTarget</code>
              to show the control's shortcut. <code>addComposite()</code> displays several entries
              together.
            </p>

            <TooltipExample onDidInitialize={this.didInitializeExample.bind(this)} />
          </StyleguideSection>

          <StyleguideSection
            onDidInitialize={this.didInitializeSection.bind(this)}
            name="error-messages"
            title="Messages"
          >
            <p>
              Use to convey info to the user when something happens. See <code>search-panel</code>
              for an example.
            </p>

            <h3>Error messages</h3>
            {this.renderExampleHTML(dedent`
              <ul class='error-messages block'>
                <li>This is an error!</li>
                <li>And another</li>
              </ul>
            `)}

            <h3>Info messages</h3>
            {this.renderExampleHTML(dedent`
              <ul class='info-messages block'>
                <li>Info line</li>
                <li>Another info line</li>
              </ul>
            `)}

            <h3>Background Messages</h3>
            <p>Subtle background messages for panes. Use for cases when there are no results.</p>

            {this.renderExampleHTML(dedent`
              <ul class='background-message'>
                <li>No Results</li>
              </ul>
            `)}

            <p>
              Centered background messages will center horizontally and vertically. Your container
              for this element must have <code>position</code> set with <code>relative</code> or
              <code>absolute</code>.
            </p>

            {this.renderExampleHTML(dedent`
              <ul class='background-message centered'>
                <li>No Results</li>
              </ul>
            `)}
          </StyleguideSection>

          <StyleguideSection
            onDidInitialize={this.didInitializeSection.bind(this)}
            name="progress"
            title="Loading/Progress"
          >
            <h3>Progress Bars</h3>
            {this.renderExampleHTML(dedent`
              <div class='block'>
                <progress class='inline-block'></progress>
                <span class='inline-block'>Indeterminate</span>
              </div>

              <div class='block'>
                <progress class='inline-block' max='100' value='25'></progress>
                <span class='inline-block'>At 25%</span>
              </div>

              <div class='block'>
                <progress class='inline-block' max='100' value='50'></progress>
                <span class='inline-block'>At 50%</span>
              </div>

              <div class='block'>
                <progress class='inline-block' max='100' value='75'></progress>
                <span class='inline-block'>At 75%</span>
              </div>

              <div class='block'>
                <progress class='inline-block' max='100' value='100'></progress>
                <span class='inline-block'>At 100%</span>
              </div>
            `)}

            <h3>Loading Spinners</h3>
            {this.renderExampleHTML(dedent`
              <span class='loading loading-spinner-tiny inline-block'></span>
              <span class='loading loading-spinner-small inline-block'></span>
              <span class='loading loading-spinner-medium inline-block'></span>
              <span class='loading loading-spinner-large inline-block'></span>
            `)}
          </StyleguideSection>
        </main>
      </div>
    );
  }

  renderExampleHTML(html) {
    return <HTMLExample html={html} />;
  }

  renderIconGallery(title, names) {
    return [
      <h3>{title}</h3>,
      <div className="example">
        <div className="example-rendered icon-gallery">
          {names.map((name) => (
            <span className={`icon icon-${name}`}>{name}</span>
          ))}
        </div>
      </div>,
    ];
  }

  renderVariableGroups() {
    return [
      ["Colors", "variable-colors", (variable) => variable.type === "color"],
      ["Other variables", "variable-values", (variable) => variable.type !== "color"],
    ].map(([title, tableClass, matches]) => {
      const groups = new Map();
      for (const variable of this.themeVariables.filter(matches)) {
        const group =
          tableClass === "variable-values" && variable.group === "Component colors"
            ? "Components"
            : variable.group;
        if (!groups.has(group)) groups.set(group, []);
        groups.get(group).push(variable);
      }
      return [
        <h3>{title}</h3>,
        Array.from(groups, ([group, variables]) => [
          <h4>{group}</h4>,
          this.renderVars(variables, tableClass),
        ]),
      ];
    });
  }

  renderVars(variables, tableClass) {
    return (
      <div className="example">
        <div className={`example-rendered ${tableClass}`}>
          {variables.map((variable) => (
            <div
              className="variable-row"
              dataset={{ var: variable.name, type: variable.type, scope: variable.scope }}
              style={`--swatch: var(--${variable.name})`}
            >
              <code>--{variable.name}</code>
              <span className="is-description">{variable.description}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Label every variable swatch with the value the active theme resolves it
  // to. A hidden probe element resolves each `var()` to a used value (an
  // actual color / length / font family), which also works while a section is
  // collapsed.
  updateResolvedValues() {
    const container = this.element;
    if (this.destroyed || !container?.isConnected) return;

    const probe = document.createElement("span");
    probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;display:block;";
    container.appendChild(probe);
    try {
      for (const el of container.querySelectorAll("[data-var]")) {
        const name = el.dataset.var;
        let value;
        if (el.dataset.type === "color") {
          probe.style.color = `var(--${name})`;
          value = getComputedStyle(probe).color;
          probe.style.color = "";
        } else if (el.dataset.type === "font-family") {
          probe.style.fontFamily = `var(--${name})`;
          value = getComputedStyle(probe).fontFamily;
          probe.style.fontFamily = "";
        } else if (el.dataset.type === "length") {
          probe.style.width = `var(--${name})`;
          value = getComputedStyle(probe).width;
          probe.style.width = "";
        } else if (el.dataset.type === "line-height") {
          probe.style.fontSize = "var(--editor-font-size)";
          probe.style.lineHeight = `var(--${name})`;
          value = getComputedStyle(probe).lineHeight;
          probe.style.lineHeight = "";
          probe.style.fontSize = "";
        } else {
          value = getComputedStyle(probe).getPropertyValue(`--${name}`).trim();
        }

        let label = el.querySelector(":scope > .is-value");
        if (!label) {
          label = document.createElement("span");
          label.className = "is-value";
          el.insertBefore(label, el.querySelector(":scope > .is-description"));
        }
        label.textContent = value;
      }
    } finally {
      container.removeChild(probe);
    }
  }

  didInitializeSection(section) {
    this.sections.push(section);
    section.onDidExpandOrCollapseSection = () => this.scheduleResolvedValues();
  }

  didInitializeExample(example) {
    if (this.destroyed) return example.destroy();
    this.examples.add(example);
  }
};
