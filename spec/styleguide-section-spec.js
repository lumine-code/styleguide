describe("Styleguide sections", () => {
  let StyleguideSection;
  let etch;
  let section;
  let childCreated;
  let childDestroyed;
  let ExampleChild;

  beforeEach(async () => {
    await lumine.packages.activatePackage("styleguide");
    StyleguideSection = require("../lib/styleguide-section");
    etch = require("@lumine-code/etch");
    childCreated = 0;
    childDestroyed = 0;
    ExampleChild = class {
      constructor() {
        childCreated++;
        this.element = document.createElement("div");
        this.element.className = "section-example";
      }

      update() {}

      destroy() {
        childDestroyed++;
        this.element.remove();
      }
    };
  });

  afterEach(async () => {
    await section?.destroy();
    section = null;
  });

  function createSection(props = {}) {
    section = new StyleguideSection({ name: "example", title: "Example", ...props }, [
      etch.dom(ExampleChild),
    ]);
    jasmine.attachToDOM(section.element);
    return section;
  }

  it("keeps collapsed examples lazy and exposes a focusable native toggle", async () => {
    createSection();
    const button = section.element.querySelector(".section-heading > button");
    expect(childCreated).toBe(0);
    expect(section.element.classList.contains("collapsed")).toBe(true);
    expect(button.type).toBe("button");
    expect(button.tabIndex).toBe(0);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    button.focus();
    expect(document.activeElement).toBe(button);

    button.click();
    await waitForFrames(() => button.getAttribute("aria-expanded") === "true");
    expect(section.collapsed).toBe(false);
    expect(childCreated).toBe(1);
    expect(section.element.querySelector(".section-example")).not.toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it("honors expanded initial state and retains examples between toggles", async () => {
    createSection({ collapsed: false });
    const child = section.element.querySelector(".section-example");
    expect(childCreated).toBe(1);
    expect(section.element.querySelector("button").getAttribute("aria-expanded")).toBe("true");

    await section.collapse();
    expect(childDestroyed).toBe(0);
    expect(section.element.querySelector(".section-example")).toBe(child);
    await section.expand();
    expect(childCreated).toBe(1);
    expect(section.element.querySelector(".section-example")).toBe(child);
  });

  it("updates titles, children and collapse state and notifies after rendering", async () => {
    const callback = jasmine.createSpy("section changed").and.callFake((current) => {
      expect(current).toBe(section);
      expect(current.element.querySelector("button").getAttribute("aria-expanded")).toBe(
        String(!current.collapsed),
      );
    });
    createSection({ onDidExpandOrCollapseSection: callback });
    await section.update({ title: "Updated example", name: "updated", collapsed: false });
    expect(section.element.dataset.name).toBe("updated");
    expect(section.element.querySelector("button").textContent).toBe("Updated example");
    expect(childCreated).toBe(1);
    expect(callback).toHaveBeenCalledTimes(1);

    await section.expand();
    expect(callback).toHaveBeenCalledTimes(1);
    await section.update({}, []);
    expect(childDestroyed).toBe(1);
    expect(section.element.querySelector(".section-example")).toBeNull();
  });

  it("replaces and removes state-change callbacks", async () => {
    const original = jasmine.createSpy("original callback");
    const replacement = jasmine.createSpy("replacement callback");
    createSection({ onDidExpandOrCollapseSection: original });
    await section.expand();
    expect(original).toHaveBeenCalledTimes(1);
    await section.update({ onDidExpandOrCollapseSection: replacement });
    await section.collapse();
    expect(original).toHaveBeenCalledTimes(1);
    expect(replacement).toHaveBeenCalledTimes(1);
    await section.update({ onDidExpandOrCollapseSection: null });
    await section.expand();
    expect(replacement).toHaveBeenCalledTimes(1);
  });

  it("destroys loaded child components once and ignores later updates", async () => {
    const callback = jasmine.createSpy("section changed");
    createSection({ collapsed: false, onDidExpandOrCollapseSection: callback });
    const pendingUpdate = section.collapse();
    await section.destroy();
    await pendingUpdate;
    await section.destroy();
    await section.expand();
    await section.update({ collapsed: false }, [etch.dom(ExampleChild)]);
    expect(childDestroyed).toBe(1);
    expect(childCreated).toBe(1);
    expect(callback).not.toHaveBeenCalled();
    expect(section.element.isConnected).toBe(false);
  });
});
