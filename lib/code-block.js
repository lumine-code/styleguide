const { TextEditor } = require("lumine");

module.exports = class CodeBlock {
  constructor(props) {
    this.destroyed = false;
    this.grammarSubscription = null;
    this.editor = new TextEditor({
      readOnly: true,
      keyboardInputEnabled: false,
      softWrapped: true,
      softWrapAtPreferredLineLength: false,
      showInvisibles: false,
    });
    this.element = document.createElement("div");
    this.element.appendChild(this.editor.getElement());
    this.editor.onDidDestroy(() => this.destroy());
    this.update(props);
  }

  update({ cssClass = "", code = "", grammarScopeName = null }) {
    if (this.destroyed) return;
    this.editor.setText(code, { bypassReadOnly: true });
    this.element.className = cssClass;
    if (grammarScopeName !== this.grammarScopeName) {
      this.setGrammarScopeName(grammarScopeName);
    }
  }

  setGrammarScopeName(scopeName) {
    this.grammarSubscription?.dispose();
    this.grammarSubscription = null;
    this.grammarScopeName = scopeName;
    if (scopeName && lumine.grammars.assignLanguageMode(this.editor, scopeName)) return;
    if (!lumine.grammars.assignLanguageMode(this.editor, "text.plain")) {
      lumine.grammars.assignLanguageMode(this.editor, null);
    }
    if (!scopeName) return;

    // Own the wait so changing examples or destroying the view can cancel it.
    // A later view must check the registry again after a language package reload.
    this.grammarSubscription = lumine.grammars.onDidAddGrammar((grammar) => {
      if (this.destroyed || scopeName !== this.grammarScopeName) return;
      if (grammar?.scopeName !== scopeName) return;
      if (!lumine.grammars.assignLanguageMode(this.editor, scopeName)) return;
      this.grammarSubscription?.dispose();
      this.grammarSubscription = null;
    });
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.grammarSubscription?.dispose();
    this.grammarSubscription = null;
    this.editor.destroy();
    this.element.remove();
  }
};
