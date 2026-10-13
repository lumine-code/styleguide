const path = require("node:path");

describe("Styleguide native opening", () => {
  let main, pack, views;

  beforeEach(async () => {
    jasmine.attachToDOM(lumine.workspace.getElement());
    if (lumine.packages.isPackageLoaded("styleguide"))
      await lumine.packages.unloadPackage("styleguide");
    pack = await lumine.packages.activatePackage("styleguide");
    main = pack.mainModule;
    views = [];
  });

  afterEach(async () => {
    for (const view of views) await view.destroy();
    await lumine.packages.unloadPackage("styleguide");
  });

  async function holdImport() {
    const module = await main.importViewRuntime();
    let release;
    spyOn(main, "importViewRuntime").and.returnValue(
      new Promise((resolve) => (release = () => resolve(module))),
    );
    return release;
  }

  it("retains a synchronous restoration factory", () => {
    spyOn(main, "importViewRuntime").and.callThrough();
    const view = main.createStyleguideView({ uri: "lumine://styleguide" });
    views.push(view);
    expect(view.then).toBeUndefined();
    expect(main.importViewRuntime).not.toHaveBeenCalled();
  });

  it("shares native loading across calls and keeps current CommonJS constructor identity", async () => {
    spyOn(main, "importViewRuntime").and.callThrough();
    const [first, second] = await Promise.all([main.loadViewRuntime(), main.loadViewRuntime()]);
    expect(first).toBe(second);
    expect(main.importViewRuntime).toHaveBeenCalledTimes(1);
    const view = await lumine.workspace.open("lumine://styleguide");
    views.push(view);
    const View = require(path.join(pack.path, "lib/styleguide-view.jsx"));
    expect(view instanceof View).toBe(true);
  });

  it("does not construct a view after its pending opener is aborted", async () => {
    const release = await holdImport();
    const controller = new AbortController();
    spyOn(main, "createStyleguideView").and.callThrough();
    const pending = main.openStyleguideView(
      { uri: "lumine://styleguide" },
      { signal: controller.signal },
    );
    controller.abort();
    release();
    expect(await pending).toBeUndefined();
    expect(main.createStyleguideView).not.toHaveBeenCalled();
  });

  it("does not create an old view after its package is reloaded", async () => {
    const release = await holdImport();
    const retired = main;
    spyOn(retired, "createStyleguideView").and.callThrough();
    const pending = main.openStyleguideView({ uri: "lumine://styleguide" });
    await lumine.packages.unloadPackage("styleguide");
    main = (await lumine.packages.activatePackage("styleguide")).mainModule;
    release();
    expect(await pending).toBeUndefined();
    expect(retired.createStyleguideView).not.toHaveBeenCalled();
    const view = await main.openStyleguideView({ uri: "lumine://styleguide" });
    views.push(view);
    expect(view.destroyed).toBe(false);
  });

  it("allows the next opener to retry a failed import", async () => {
    spyOn(main, "importViewRuntime").and.rejectWith(new Error("Held styleguide import failed"));
    await expectAsync(
      main.openStyleguideView({ uri: "lumine://styleguide" }),
    ).toBeRejectedWithError("Held styleguide import failed");
    main.importViewRuntime.and.callThrough();
    views.push(await main.openStyleguideView({ uri: "lumine://styleguide" }));
    expect(main.importViewRuntime).toHaveBeenCalledTimes(2);
  });

  it("does not construct into a presentation window closed during import", async () => {
    const window = await lumine.workspace.openEditorWindow({ show: false });
    const release = await holdImport();
    spyOn(main, "createStyleguideView").and.callThrough();
    const pending = main.openStyleguideView({ uri: "lumine://styleguide" }, { window });
    await lumine.workspace.discardEditorWindows();
    release();
    expect(await pending).toBeUndefined();
    expect(main.createStyleguideView).not.toHaveBeenCalled();
  });
});
