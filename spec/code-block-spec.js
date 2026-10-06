describe("Styleguide code blocks", () => {
  let CodeBlock;
  let blocks;

  function createBlock(props = {}) {
    const block = new CodeBlock({
      cssClass: "example-html",
      code: "<div>Hello</div>",
      grammarScopeName: "text.html.basic",
      ...props,
    });
    blocks.push(block);
    return block;
  }

  beforeEach(async () => {
    await lumine.packages.activatePackage("language-text");
    CodeBlock = require("../lib/code-block");
    blocks = [];
  });

  afterEach(() => {
    for (const block of blocks) block.destroy();
  });

  it("assigns an already available grammar synchronously", async () => {
    await lumine.packages.activatePackage("language-html");
    const subscribe = spyOn(lumine.grammars, "onDidAddGrammar").and.callThrough();
    const block = createBlock();

    expect(block.editor.getGrammar().scopeName).toBe("text.html.basic");
    expect(block.editor.getText()).toBe("<div>Hello</div>");
    expect(block.editor.isReadOnly()).toBe(true);
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("wraps source to the available width without changing it or displaying invisibles", async () => {
    jasmine.useRealClock();
    lumine.config.set("editor.softWrap", false);
    lumine.config.set("editor.softWrapAtPreferredLineLength", true);
    lumine.config.set("editor.preferredLineLength", 20);
    lumine.config.set("editor.showInvisibles", true);
    const code = `  <div>${"long example content ".repeat(16)}</div>\n`;
    const block = createBlock({ cssClass: "example-code", grammarScopeName: "text.plain", code });
    // Supply substitutions so a stray showInvisibles setting would be visible.
    block.editor.update({ invisibles: { space: "·", eol: "¶" } });
    const container = document.createElement("div");
    container.style.cssText = "width: 640px; min-height: 120px;";
    container.appendChild(block.element);
    jasmine.attachToDOM(container);
    const element = block.editor.getElement();
    const component = element.getComponent();

    await conditionPromise(
      () =>
        component.visible &&
        component.hasInitialMeasurements &&
        element.getBoundingClientRect().height > 0 &&
        block.editor.getScreenLineCount() > block.editor.getLineCount(),
      "the code block to wrap and size itself",
    );
    const wideLineCount = block.editor.getScreenLineCount();
    const wideHeight = element.getBoundingClientRect().height;
    const wideWidth = component.getScrollContainerClientWidth();

    expect(block.editor.lineTextForScreenRow(0).length).toBeGreaterThan(20);
    expect(block.editor.showInvisibles).toBe(false);
    expect(element.querySelector(".invisible-character")).toBeNull();
    expect(container.scrollWidth).toBeLessThanOrEqual(container.clientWidth);
    expect(component.canScrollHorizontally()).toBe(false);

    container.style.width = "260px";
    await conditionPromise(() => {
      // CI may delay ResizeObserver delivery; request the same measurement a
      // real resize performs while preserving the renderer's wrapping path.
      component.didResize();
      return (
        component.getScrollContainerClientWidth() < wideWidth &&
        block.editor.getScreenLineCount() > wideLineCount &&
        element.getBoundingClientRect().height > wideHeight
      );
    }, "the narrower code block to reflow and grow in height");

    expect(block.editor.getText()).toBe(code);
    expect(block.editor.getAutoHeight()).toBe(true);
    expect(element.getBoundingClientRect().height).toBeGreaterThan(0);
    expect(element.getScrollWidth()).toBeLessThanOrEqual(element.getWidth());
    expect(container.scrollWidth).toBeLessThanOrEqual(container.clientWidth);
    expect(component.canScrollHorizontally()).toBe(false);
    expect(element.querySelector(".invisible-character")).toBeNull();
  });

  it("keeps another block's grammar wait alive when one block is destroyed", async () => {
    const discarded = createBlock();
    const live = createBlock();
    expect(live.editor.getGrammar().scopeName).toBe("text.plain");

    discarded.destroy();
    await lumine.packages.activatePackage("language-html");

    expect(discarded.editor.isDestroyed()).toBe(true);
    expect(live.editor.getGrammar().scopeName).toBe("text.html.basic");
    expect(live.grammarSubscription).toBeNull();
  });

  it("updates the example's text and classes and waits only for its latest grammar", async () => {
    const block = createBlock({ grammarScopeName: "source.js" });
    const previousWait = block.grammarSubscription;
    const dispose = spyOn(previousWait, "dispose").and.callThrough();

    block.update({
      cssClass: "example-code highlighted",
      code: "<p>Changed</p>",
      grammarScopeName: "text.html.basic",
    });
    expect(block.editor.getText()).toBe("<p>Changed</p>");
    expect(block.element.className).toBe("example-code highlighted");
    expect(dispose).toHaveBeenCalledTimes(1);

    await lumine.packages.activatePackage("language-javascript");
    expect(block.editor.getGrammar().scopeName).toBe("text.plain");
    await lumine.packages.activatePackage("language-html");
    expect(block.editor.getGrammar().scopeName).toBe("text.html.basic");
  });

  it("returns to plain text when the example no longer requests a grammar", async () => {
    await lumine.packages.activatePackage("language-html");
    const block = createBlock();

    block.update({ cssClass: "example-text", code: "Plain text", grammarScopeName: null });

    expect(block.editor.getGrammar().scopeName).toBe("text.plain");
    expect(block.grammarSubscription).toBeNull();
  });

  it("waits again after a previously requested grammar is unloaded", async () => {
    const first = createBlock();
    await lumine.packages.activatePackage("language-html");
    expect(first.editor.getGrammar().scopeName).toBe("text.html.basic");
    first.destroy();
    await lumine.packages.deactivatePackage("language-html");

    const second = createBlock();
    expect(second.editor.getGrammar().scopeName).toBe("text.plain");
    await lumine.packages.activatePackage("language-html");

    expect(second.editor.getGrammar().scopeName).toBe("text.html.basic");
  });

  it("destroys its editor and cancels pending grammar work idempotently", () => {
    const subscribe = spyOn(lumine.grammars, "onDidAddGrammar").and.callThrough();
    const block = createBlock({ grammarScopeName: "source.styleguide-missing" });
    const buffer = block.editor.getBuffer();
    const callback = subscribe.calls.mostRecent().args[0];
    const dispose = spyOn(block.grammarSubscription, "dispose").and.callThrough();
    const destroyEditor = spyOn(block.editor, "destroy").and.callThrough();
    const assign = spyOn(lumine.grammars, "assignLanguageMode").and.callThrough();
    jasmine.attachToDOM(block.element);

    block.destroy();
    block.destroy();
    callback({ scopeName: "source.styleguide-missing" });
    block.update({ code: "Discarded", grammarScopeName: "text.plain" });

    expect(dispose).toHaveBeenCalledTimes(1);
    expect(destroyEditor).toHaveBeenCalledTimes(1);
    expect(buffer.isDestroyed()).toBe(true);
    expect(lumine.grammars.grammarScoresByBuffer.has(buffer)).toBe(false);
    expect(block.element.isConnected).toBe(false);
    expect(assign).not.toHaveBeenCalled();
  });

  it("cancels its grammar wait when its editor is destroyed directly", () => {
    const block = createBlock({ grammarScopeName: "source.styleguide-missing" });
    const dispose = spyOn(block.grammarSubscription, "dispose").and.callThrough();

    block.editor.destroy();

    expect(block.destroyed).toBe(true);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(block.grammarSubscription).toBeNull();
  });
});
