describe("Styleguide scrollbar navigation", () => {
  let view, bind;

  beforeEach(async () => {
    await lumine.packages.activatePackage("language-text");
    const main = (await lumine.packages.activatePackage("styleguide")).mainModule;
    bind = spyOn(lumine.scrollbars, "bindNavigation").and.callThrough();
    view = main.createStyleguideView({ uri: "lumine://styleguide" });
    jasmine.attachToDOM(view.element);
  });

  afterEach(async () => view.destroy());

  it("routes root focus and navigation to the sections while leaving controls native", () => {
    const content = view.element.querySelector(".styleguide-sections");
    expect(bind).toHaveBeenCalledOnceWith(content);
    expect(content.tabIndex).toBe(-1);
    const focus = spyOn(content, "focus");
    view.element.dispatchEvent(new FocusEvent("focus"));
    expect(focus).toHaveBeenCalledOnceWith({ preventScroll: true });
    const reveal = spyOn(lumine.scrollbars, "reveal");
    lumine.commands.dispatch(content, "core:page-down");
    expect(reveal).toHaveBeenCalledOnceWith(content);
    reveal.calls.reset();
    lumine.commands.dispatch(view.element.querySelector("button"), "core:page-down");
    expect(reveal).not.toHaveBeenCalled();
  });

  it("removes the navigation owner and root focus handoff on destruction", async () => {
    const content = view.refs.content;
    const binding = bind.calls.mostRecent().returnValue;
    const focus = spyOn(content, "focus");
    await view.destroy();
    expect(binding.disposed).toBeTrue();
    view.element.dispatchEvent(new FocusEvent("focus"));
    expect(focus).not.toHaveBeenCalled();
  });
});
