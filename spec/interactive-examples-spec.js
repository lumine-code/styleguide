describe("Styleguide interactive examples", () => {
  let workspaceElement;
  let InputDialogExample;
  let MenuExample;
  let TooltipExample;
  let ExampleSelectListView;
  let examples;

  beforeEach(async () => {
    jasmine.useRealClock();
    workspaceElement = lumine.views.getView(lumine.workspace);
    jasmine.attachToDOM(workspaceElement);
    await lumine.packages.activatePackage("language-text");
    await lumine.packages.activatePackage("styleguide");
    ({ InputDialogExample, MenuExample, TooltipExample } = require("../lib/interactive-examples"));
    ExampleSelectListView = require("../lib/example-select-list-view");
    examples = [];
  });

  afterEach(async () => {
    await Promise.all(examples.map((example) => example.destroy()));
  });

  function attach(Example) {
    const example = new Example();
    examples.push(example);
    workspaceElement.appendChild(example.element);
    return example;
  }

  it("builds previews without changing focus or opening a menu", () => {
    const focusTarget = document.createElement("button");
    workspaceElement.appendChild(focusTarget);
    focusTarget.focus();

    for (const Example of [
      InputDialogExample,
      MenuExample,
      TooltipExample,
      ExampleSelectListView,
    ]) {
      const example = attach(Example);
      expect(document.activeElement).toBe(focusTarget);
      expect(example.element.querySelector(".example-js lumine-text-editor")).not.toBeNull();
    }

    expect(examples[1].popup).toBeNull();
    expect(examples[3].selectList.getSelectedItem()).toBeNull();
    focusTarget.remove();
  });

  it("validates input and clears the validation message when the query changes", async () => {
    const example = attach(InputDialogExample);
    await example.submit();
    expect(example.dialog.getStatus()).toEqual({ type: "error", message: "Enter a name." });
    expect(example.element.querySelector('[role="alert"]').textContent).toBe("Enter a name.");

    const queryChanged = new Promise((resolve) => {
      const subscription = example.dialog.onDidChangeQuery(() => {
        subscription.dispose();
        resolve();
      });
    });
    await example.dialog.setQuery("  Lumine  ");
    await queryChanged;
    expect(example.dialog.getStatus()).toBeNull();
    await example.submit();
    expect(example.dialog.getStatus()).toEqual({ type: "info", message: "Submitted: Lumine." });

    await example.reset();
    expect(example.dialog.getQuery()).toBe("");
    expect(example.dialog.getStatus()).toBeNull();
  });

  it("confirms a selected row through its declared action", async () => {
    const example = attach(ExampleSelectListView);
    await example.selectList.selectItem("two");
    await example.selectList.confirm();

    expect(example.selectList.getStatus()).toEqual({ type: "info", message: "Selected: two." });
    expect(example.element.querySelector(".status-message").textContent).toBe("Selected: two.");
  });

  it("retains a confirmation when query typography changes without changing its text", async () => {
    const example = attach(ExampleSelectListView);
    await example.selectList.selectItem("two");
    await example.selectList.confirm();
    await example.selectList.setStatus({ type: "info", message: "Selected: two." });
    expect(example.selectList.getStatus()).toEqual({ type: "info", message: "Selected: two." });
    const query = example.selectList.getQuery();
    const editor = example.selectList.getQueryEditor();
    editor.setTabLength(editor.getTabLength() + 1);

    expect(example.selectList.getQuery()).toBe(query);
    expect(example.selectList.getStatus()).toEqual({ type: "info", message: "Selected: two." });
  });

  it("dispatches menu choices locally and keeps checkbox state on reopening", async () => {
    const example = attach(MenuExample);
    const popup = example.showMenu();
    popup.rootList.items[0].element.click();
    await flushMicrotasks();

    expect(example.refs.status.textContent).toBe("Selected: Alpha.");
    expect(example.popup).toBeNull();

    const togglePopup = example.showMenu();
    expect(togglePopup.rootList.items[3].element.getAttribute("aria-checked")).toBe("true");
    togglePopup.rootList.items[3].element.click();
    await flushMicrotasks();
    expect(example.refs.status.textContent).toBe("Example option: off.");

    const reopened = example.showMenu();
    expect(reopened.rootList.items[3].element.getAttribute("aria-checked")).toBe("false");
  });

  it("destroys an open popup and unregisters its local commands only once", async () => {
    const example = attach(MenuExample);
    const popup = example.showMenu();
    spyOn(popup, "destroy").and.callThrough();
    const element = example.element;
    expect(lumine.commands.findCommands({ target: element }).map(({ name }) => name)).toContain(
      "styleguide:choose-menu-example",
    );

    const firstDestroy = example.destroy();
    expect(example.destroy()).toBe(firstDestroy);
    await firstDestroy;

    expect(popup.destroy.calls.count()).toBe(1);
    expect(popup.closed).toBe(true);
    expect(lumine.commands.findCommands({ target: element }).map(({ name }) => name)).not.toContain(
      "styleguide:choose-menu-example",
    );
    expect(example.showMenu()).toBeUndefined();
  });

  it("shows real single and composite tooltips and disposes both registrations", async () => {
    const example = attach(TooltipExample);
    const singleTarget = example.refs.single;
    const compositeTarget = example.refs.composite;
    const single = lumine.tooltips.findTooltips(singleTarget)[0];
    const composite = lumine.tooltips.findTooltips(compositeTarget)[0];
    expect(single).toBeDefined();
    expect(composite).toBeDefined();

    singleTarget.click();
    expect(single.getTooltipElement().textContent).toContain("A tooltip from the shared API.");
    compositeTarget.click();
    expect(composite.getTooltipElement().querySelectorAll(".tooltip-composite-item").length).toBe(
      2,
    );
    expect(composite.getTooltipElement().querySelector(".keystroke")).not.toBeNull();

    const firstDestroy = example.destroy();
    expect(example.destroy()).toBe(firstDestroy);
    await firstDestroy;
    expect(lumine.tooltips.findTooltips(singleTarget).length).toBe(0);
    expect(lumine.tooltips.findTooltips(compositeTarget).length).toBe(0);
    expect(single.getTooltipElement().isConnected).toBe(false);
    expect(composite.getTooltipElement().isConnected).toBe(false);
  });

  it("destroys inline query models and code editors when their examples close", async () => {
    for (const Example of [InputDialogExample, ExampleSelectListView]) {
      const example = attach(Example);
      const model = example.dialog ?? example.selectList;
      const queryEditor = model.getQueryEditor();
      const codeEditor = example.element.querySelector(".example-js lumine-text-editor").getModel();
      const firstDestroy = example.destroy();
      expect(example.destroy()).toBe(firstDestroy);
      await firstDestroy;

      expect(queryEditor.isDestroyed()).toBe(true);
      expect(codeEditor.isDestroyed()).toBe(true);
      expect(example.element.isConnected).toBe(false);
    }
  });
});
