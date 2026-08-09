const { CompositeDisposable } = require("lumine");
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

  deactivate() {
    this.subscriptions.dispose();
  },

  createStyleguideView(state) {
    if (StyleguideView == null) StyleguideView = require("./styleguide-view");
    return new StyleguideView(state);
  },
};
