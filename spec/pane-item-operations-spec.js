describe("styleguide copied pane item lifecycle", () => {
  let uri;

  beforeEach(async () => {
    lumine.config.set("about.showOnStartup", false);
    await lumine.packages.activatePackage("styleguide");
    jasmine.attachToDOM(lumine.workspace.getElement());
    uri = "lumine://styleguide";
  });

  afterEach(async () => {
    await lumine.packages.deactivatePackage("styleguide");
  });

  it("keeps a copied view functional after its source closes and retires every copy on unload", async () => {
    const source = await lumine.workspace.open(uri);
    const sourcePane = lumine.workspace.paneForItem(source);
    const first = await lumine.workspace.copyPaneItem(source, { splitDirection: "right" });
    expect(first.item).not.toBe(source);
    expect(lumine.views.getView(first.item)).not.toBe(lumine.views.getView(source));
    await sourcePane.destroyItem(source, true);
    const second = await lumine.workspace.copyPaneItem(first.item, { splitDirection: "down" });
    expect(second.item).not.toBe(first.item);
    expect(lumine.views.getView(second.item)).not.toBe(lumine.views.getView(first.item));
    expect(lumine.workspace.paneForItem(first.item)).toBe(first.pane);
    await lumine.packages.deactivatePackage("styleguide");
    expect(lumine.workspace.getPaneItems().filter((item) => item.getURI?.() === uri)).toEqual([]);
  });

  it("keeps a later request for the top of a copy ahead of its scheduled source viewport", async () => {
    const source = await lumine.workspace.open(uri);
    source.element.style.height = "200px";
    source.element.style.flex = "none";
    const sourceScroller = source.element.querySelector(".styleguide-sections");
    sourceScroller.scrollTop = 400;
    expect(sourceScroller.scrollTop).toBeGreaterThan(0);
    const scheduled = [];
    const frames = spyOn(window, "requestAnimationFrame").and.callFake((callback) => {
      scheduled.push(callback);
      return scheduled.length;
    });
    try {
      const copy = source.copy();
      lumine.workspace.paneForItem(source).splitRight({ items: [copy] });
      await lumine.commands.dispatch(copy.element, "core:move-to-top");
      const copyScroller = copy.element.querySelector(".styleguide-sections");
      copyScroller.scrollTop = 0;
      for (const callback of scheduled.splice(0)) callback(performance.now());
      expect(copyScroller.scrollTop).toBe(0);
    } finally {
      frames.and.callThrough();
    }
  });

  it("preserves the displayed viewport when a copy is copied again before its first paint", async () => {
    const source = await lumine.workspace.open(uri);
    source.element.style.height = "200px";
    source.element.style.flex = "none";
    const sourceScroller = source.element.querySelector(".styleguide-sections");
    sourceScroller.scrollTop = 400;
    const scrollTop = sourceScroller.scrollTop;
    expect(scrollTop).toBeGreaterThan(0);
    const scheduled = [];
    const frames = spyOn(window, "requestAnimationFrame").and.callFake((callback) => {
      scheduled.push(callback);
      return 70000 + scheduled.length;
    });
    try {
      const first = source.copy();
      const firstPane = lumine.workspace.paneForItem(source).splitRight({ items: [first] });
      const second = first.copy();
      firstPane.splitDown({ items: [second] });
      for (const callback of scheduled.splice(0)) callback(performance.now());
      expect(second.element.querySelector(".styleguide-sections").scrollTop).toBe(scrollTop);
    } finally {
      frames.and.callThrough();
    }
  });
});
