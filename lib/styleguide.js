const { CompositeDisposable } = require("lumine");
const etch = require("@lumine-code/etch");

// Etch holds its scheduler per copy of the library, and this package resolves
// its own copy — so the assignment the editor makes on core's copy never
// reaches it. Point it at the view registry before anything renders, or this
// package's DOM writes land on an animation frame of their own alongside the
// editor's and force a synchronous reflow.
etch.setScheduler(lumine.views);

let StyleguideView = null;

const STYLEGUIDE_URI = "lumine://styleguide";

module.exports = {
  activate() {
    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(
      lumine.workspace.addOpener((filePath) => {
        if (filePath === STYLEGUIDE_URI) return this.createStyleguideView({ uri: STYLEGUIDE_URI });
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
      if (pane) closures.push(pane.destroyItem(item, true));
      else item.destroy?.();
    }
    await Promise.all(closures);
  },

  createStyleguideView(state) {
    if (StyleguideView == null) StyleguideView = require("./styleguide-view");
    return new StyleguideView(state);
  },
};
