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
});
