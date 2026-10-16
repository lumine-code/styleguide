const path = require("node:path");
const { createRequire } = require("node:module");

describe("Styleguide example command availability", () => {
  it("requires the menu row's detail and remains local to its live example", async () => {
    jasmine.useRealClock();
    jasmine.attachToDOM(lumine.workspace.getElement());
    const pack = await lumine.packages.activatePackage("styleguide");
    const requireActive = createRequire(path.join(pack.path, "package.json"));
    const { MenuExample } = requireActive("./lib/interactive-examples.jsx");
    const example = new MenuExample();
    lumine.workspace.getElement().append(example.element);
    const command = "styleguide:choose-menu-example";
    expect(lumine.commands.canDispatch(example.element, command)).toBe(false);
    expect(lumine.commands.dispatch(example.element, command)).toBeNull();
    expect(lumine.commands.canDispatch(example.element, command, { label: "Alpha" })).toBe(true);
    await lumine.commands.dispatch(example.element, command, { label: "Alpha" });
    expect(example.refs.status.textContent).toBe("Selected: Alpha.");
    await example.destroy();
    expect(lumine.commands.canDispatch(example.element, command, { label: "Alpha" })).toBe(false);
  });
});
