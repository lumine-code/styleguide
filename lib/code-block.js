const { TextEditor } = require("lumine");

const PROMISES_BY_SCOPE_NAME = new Map();

module.exports = class CodeBlock {
  constructor(props) {
    this.editor = new TextEditor({ readonly: true, keyboardInputEnabled: false });
    this.element = document.createElement("div");
    this.element.appendChild(this.editor.getElement());
    this.update(props);
    this.whenGrammarAdded(props.grammarScopeName).then(() => {
      lumine.grammars.assignLanguageMode(this.editor, props.grammarScopeName);
    });
  }

  update({ cssClass, code }) {
    this.editor.setText(code);
    this.element.classList.add(cssClass);
  }

  whenGrammarAdded(scopeName) {
    // Lots of these will fire at once for the same scope name; we want them
    // all to use the same promise.
    if (PROMISES_BY_SCOPE_NAME.has(scopeName)) {
      return PROMISES_BY_SCOPE_NAME.get(scopeName);
    }

    let grammar = lumine.grammars.grammarForId(scopeName);
    if (grammar) return Promise.resolve(grammar);

    let promise = new Promise((resolve) => {
      let disposable = lumine.grammars.onDidAddGrammar((grammar) => {
        if (grammar?.scopeName !== scopeName) return;
        disposable.dispose();
        resolve(grammar);
      });
    });

    PROMISES_BY_SCOPE_NAME.set(scopeName, promise);
    return promise;
  }
};
