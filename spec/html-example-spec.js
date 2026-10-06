describe("Styleguide HTML examples", () => {
  let HTMLExample;
  let example;

  beforeEach(async () => {
    await lumine.packages.activatePackage("language-text");
    await lumine.packages.activatePackage("styleguide");
    HTMLExample = require("../lib/html-example");
  });

  afterEach(async () => {
    await example?.destroy();
  });

  it("owns both preview and source editors and releases them on destroy", async () => {
    example = new HTMLExample({
      html: "<lumine-text-editor mini>Example query</lumine-text-editor>",
    });
    jasmine.attachToDOM(example.element);
    const editors = Array.from(example.element.querySelectorAll("lumine-text-editor"), (element) =>
      element.getModel(),
    );
    expect(editors.length).toBe(2);
    expect(editors[0].getText()).toBe("Example query");

    await example.destroy();
    await example.destroy();

    expect(editors.every((editor) => editor.isDestroyed())).toBe(true);
    expect(editors.every((editor) => editor.getBuffer().isDestroyed())).toBe(true);
  });

  it("replaces preview editors without retaining the previous example", async () => {
    example = new HTMLExample({
      html: "<lumine-text-editor mini>First query</lumine-text-editor>",
    });
    jasmine.attachToDOM(example.element);
    const previous = example.previewEditors[0];

    await example.update({ html: "<lumine-text-editor mini>Second query</lumine-text-editor>" });

    expect(previous.isDestroyed()).toBe(true);
    expect(example.previewEditors[0].getText()).toBe("Second query");
    expect(example.previewEditors[0].isDestroyed()).toBe(false);
  });

  it("lets preview mini editors grow with the configured input typography", async () => {
    jasmine.useRealClock();
    example = new HTMLExample({
      html: "<div class='select-list'><lumine-text-editor mini>Example query</lumine-text-editor></div>",
    });
    const host = document.createElement("div");
    host.className = "styleguide";
    host.style.cssText = "width: 600px; --ui-input-font-size: 24px; --ui-row-height: 40px;";
    host.appendChild(example.element);
    jasmine.attachToDOM(host);
    const element = example.refs.preview.querySelector("lumine-text-editor");
    await waitForFrames(() => element.getBoundingClientRect().height >= 42);

    expect(element.getBoundingClientRect().height).toBeGreaterThanOrEqual(42);
    expect(element.getModel().getAutoHeight()).toBe(true);
  });
});
