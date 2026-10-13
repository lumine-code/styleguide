const { CompositeDisposable } = require("lumine");
const etch = require("@lumine-code/etch");

// Etch holds its scheduler per copy of the library, and this package resolves
// its own copy — so the assignment the editor makes on core's copy never
// reaches it. Point it at the view registry before anything renders, or this
// package's DOM writes land on an animation frame of their own alongside the
// editor's and force a synchronous reflow.
etch.setScheduler(lumine.views);

let StyleguideView = null;
let runtimePromise = null;

const STYLEGUIDE_URI = "lumine://styleguide";

module.exports = {
  activate() {
    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(
      lumine.workspace.addOpener((filePath, options) => {
        if (filePath === STYLEGUIDE_URI)
          return this.openStyleguideView({ uri: STYLEGUIDE_URI }, options);
      }),
    );
    this.subscriptions.add(
      lumine.commands.add("lumine-workspace", "styleguide:show", () =>
        lumine.workspace.open(STYLEGUIDE_URI),
      ),
    );
  },

  async deactivate() {
    this.subscriptions?.dispose();
    this.subscriptions = null;
    const closures = [];
    for (const item of lumine.workspace.getPaneItems()) {
      if (item?.getURI?.() !== STYLEGUIDE_URI) continue;
      const pane = lumine.workspace.paneForItem(item);
      if (pane) closures.push(pane.destroyItem(item, true).then(() => item.destroy?.()));
      else closures.push(item.destroy?.());
    }
    await Promise.all(closures);
  },

  createStyleguideView(state) {
    if (StyleguideView == null) StyleguideView = require("./styleguide-view");
    return new StyleguideView(state);
  },

  importViewRuntime() {
    return import("./styleguide-view.jsx");
  },

  loadViewRuntime() {
    if (StyleguideView != null) return Promise.resolve(StyleguideView);
    if (runtimePromise == null) {
      runtimePromise = this.importViewRuntime()
        .then((module) => (StyleguideView = module.default ?? module))
        .catch((error) => {
          runtimePromise = null;
          throw error;
        });
    }
    return runtimePromise;
  },

  async openStyleguideView(state, { signal, window, pane } = {}) {
    const owner = this.subscriptions;
    window ??= pane && lumine.workspace.getWindowForElement(lumine.views.getView(pane));
    window ??= lumine.workspace.getFocusedWindow() ?? lumine.workspace.getMainWindow();
    const snapshot = { ...state, collapsedSections: [...(state.collapsedSections ?? [])] };
    const isCurrent = () =>
      owner != null &&
      this.subscriptions === owner &&
      !signal?.aborted &&
      !window.isDestroyed() &&
      !pane?.isDestroyed();
    if (!isCurrent()) return;
    await this.loadViewRuntime();
    if (!isCurrent()) return;
    const view = this.createStyleguideView(snapshot);
    if (!isCurrent()) {
      await view.destroy();
      return;
    }
    return view;
  },
};
