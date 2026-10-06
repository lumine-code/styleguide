describe("Styleguide editor presentation", () => {
  it("shows the theme's cursor-line background only while the source editor has focus", async () => {
    jasmine.useRealClock();
    await lumine.packages.activatePackage("language-text");
    await lumine.packages.activatePackage("styleguide");
    const CodeBlock = require("../lib/code-block");
    const block = new CodeBlock({ code: "Example source", grammarScopeName: "text.plain" });
    const host = document.createElement("div");
    host.className = "styleguide";
    host.style.width = "640px";
    const example = document.createElement("div");
    example.className = "example";
    const source = document.createElement("div");
    source.className = "example-code";
    source.appendChild(block.element);
    example.appendChild(source);
    host.appendChild(example);
    const blurTarget = document.createElement("button");
    host.appendChild(blurTarget);
    jasmine.attachToDOM(host);
    const stylesheet = lumine.styles.addStyleSheet(
      `lumine-text-editor:not([mini]):not([input]) .line.cursor-line {
        background-color: rgb(12, 34, 56);
        box-shadow: inset 0 0 0 100vmax rgb(65, 43, 21);
      }`,
      { priority: 1 },
    );
    const element = block.editor.getElement();
    try {
      const lineStyle = () => getComputedStyle(element.querySelector(".line.cursor-line"));
      await waitForFrames(() => element.querySelector(".line.cursor-line") != null);
      expect(lineStyle().backgroundColor).toBe("rgba(0, 0, 0, 0)");
      expect(lineStyle().boxShadow).toBe("none");

      element.focus();
      await waitForFrames(() => element.classList.contains("is-focused"));
      expect(lineStyle().backgroundColor).toBe("rgb(12, 34, 56)");
      expect(lineStyle().boxShadow).not.toBe("none");

      blurTarget.focus();
      await waitForFrames(() => !element.classList.contains("is-focused"));
      expect(lineStyle().backgroundColor).toBe("rgba(0, 0, 0, 0)");
      expect(lineStyle().boxShadow).toBe("none");
    } finally {
      stylesheet.dispose();
      block.destroy();
    }
  });
});
