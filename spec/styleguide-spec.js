const COLOR_PATTERN = /^(rgb|rgba|color|oklch|lab|lch|hsl)/;

function textColorSwatch(styleGuideView) {
  return styleGuideView.element.querySelector(
    '[data-name="variables"] [data-type="color"][data-var="text-color"]',
  );
}

async function waitForTextColorSwatch(styleGuideView) {
  let swatch;
  await conditionPromise(
    () => (swatch = textColorSwatch(styleGuideView)) != null,
    "the text color swatch to render",
  );
  return swatch;
}

describe("Style Guide", () => {
  let workspaceElement;

  beforeEach(async () => {
    workspaceElement = lumine.views.getView(lumine.workspace);
    jasmine.attachToDOM(workspaceElement);
    await lumine.packages.activatePackage("language-text");
    await lumine.packages.activatePackage("styleguide");
  });

  describe("the Styleguide view", () => {
    let styleGuideView;
    beforeEach(async () => {
      styleGuideView = await lumine.workspace.open("lumine://styleguide");
    });

    it("opens the style guide", () => {
      expect(styleGuideView.element.textContent).toContain("Styleguide");
    });

    it("closes views owned by the package on deactivation", async () => {
      jasmine.useRealClock();
      await waitForTextColorSwatch(styleGuideView);
      await conditionPromise(
        () => styleGuideView.element.querySelectorAll("lumine-text-editor").length > 5,
        "the preview and source editors to render",
      );
      const editors = Array.from(
        styleGuideView.element.querySelectorAll("lumine-text-editor"),
        (element) => element.getModel(),
      );
      await lumine.packages.deactivatePackage("styleguide");

      expect(lumine.workspace.paneForItem(styleGuideView)).toBeUndefined();
      expect(styleGuideView.destroyed).toBe(true);
      expect(editors.every((editor) => editor.isDestroyed())).toBe(true);
    });

    it("cancels pending examples when a newly created view is destroyed immediately", async () => {
      await lumine.workspace.paneForItem(styleGuideView).destroyItem(styleGuideView, true);
      await styleGuideView.destroy();
      const dialog = spyOn(lumine.workspace, "buildInputDialog").and.callThrough();
      const list = spyOn(lumine.workspace, "buildSelectList").and.callThrough();
      styleGuideView = lumine.packages
        .getActivePackage("styleguide")
        .mainModule.createStyleguideView({
          uri: "lumine://styleguide",
        });

      await styleGuideView.destroy();

      expect(dialog).not.toHaveBeenCalled();
      expect(list).not.toHaveBeenCalled();
      expect(styleGuideView.element.isConnected).toBe(false);
    });

    it("assigns a grammar to its editors even if present before the correct grammar is added", async () => {
      jasmine.useRealClock();
      // Sections render on later animation frames and the grammar assignment
      // happens asynchronously after the language package activates, so poll
      // instead of sleeping for a fixed interval.
      await conditionPromise(
        () => styleGuideView.element.querySelector(".example-html lumine-text-editor") != null,
        "the HTML example editor to render",
      );
      const editor = styleGuideView.element.querySelector(".example-html lumine-text-editor");
      const te = editor.getModel();
      expect(te.getGrammar()?.scopeName).toBe("text.plain");

      await lumine.packages.activatePackage("language-html");
      await conditionPromise(
        () => te.getGrammar()?.scopeName === "text.html.basic",
        "the HTML grammar to be assigned",
      );

      expect(te.getGrammar()?.scopeName).toBe("text.html.basic");
    });

    it("documents every public variable and its contract metadata", async () => {
      jasmine.useRealClock();
      await waitForTextColorSwatch(styleGuideView);
      const variableNames = Array.from(
        styleGuideView.element.querySelectorAll('[data-name="variables"] [data-var]'),
      ).map((el) => el.dataset.var);

      const definitions = lumine.themes.getVariables();
      expect(variableNames.slice().sort()).toEqual(definitions.map(({ name }) => name).sort());
      expect(new Set(variableNames).size).toBe(definitions.length);
      for (const definition of definitions) {
        const row = styleGuideView.element.querySelector(`[data-var="${definition.name}"]`);
        expect(row.dataset.type).toBe(definition.type);
        expect(row.dataset.scope).toBe(definition.scope);
        expect(row.querySelector(".is-description").textContent).toBe(definition.description);
        expect(row.parentElement.classList.contains("variable-colors")).toBe(
          definition.type === "color",
        );
        expect(row.parentElement.classList.contains("variable-values")).toBe(
          definition.type !== "color",
        );
      }
    });

    it("resolves each value according to its type, including unitless values", async () => {
      jasmine.useRealClock();
      await waitForTextColorSwatch(styleGuideView);
      const stylesheet = lumine.styles.addStyleSheet(
        `:root {
          --text-color: rgb(12, 34, 56);
          --ui-font-size: 17px;
          --ui-border-radius: 7px;
          --ui-font-family: "Contract Font";
          --prose-line-height: 1.75;
          --overlay-backdrop-opacity: 0.42;
          --use-custom-controls: false;
        }`,
        { priority: 3 },
      );
      try {
        styleGuideView.updateResolvedValues();
        const value = (name) =>
          styleGuideView.element.querySelector(`[data-var="${name}"] > .is-value`).textContent;
        expect(value("text-color")).toBe("rgb(12, 34, 56)");
        expect(value("ui-font-size")).toBe("17px");
        expect(value("ui-border-radius")).toBe("7px");
        expect(value("ui-font-family")).toContain("Contract Font");
        expect(value("prose-line-height")).toBe("1.75");
        expect(value("overlay-backdrop-opacity")).toBe("0.42");
        expect(value("use-custom-controls")).toBe("false");
      } finally {
        stylesheet.dispose();
      }
    });

    it("keeps short values readable in a narrow variable table", async () => {
      jasmine.useRealClock();
      await waitForTextColorSwatch(styleGuideView);
      styleGuideView.element.style.width = "400px";
      styleGuideView.updateResolvedValues();

      for (const name of ["overlay-backdrop-opacity", "ui-font-size", "use-custom-controls"]) {
        const label = styleGuideView.element.querySelector(`[data-var="${name}"] > .is-value`);
        const text = document.createRange();
        text.selectNodeContents(label);
        expect(text.getClientRects().length).withContext(name).toBe(1);
      }
    });

    it("resolves editor line height as a line height and preserves normal", async () => {
      jasmine.useRealClock();
      await waitForTextColorSwatch(styleGuideView);
      const stylesheet = lumine.styles.addStyleSheet(
        "lumine-workspace { --editor-font-size: 20px; --editor-line-height: 150%; }",
        { sourcePath: "styleguide-line-height-spec", priority: 3 },
      );
      try {
        styleGuideView.updateResolvedValues();
        const row = styleGuideView.element.querySelector('[data-var="editor-line-height"]');
        expect(row.dataset.type).toBe("line-height");
        expect(row.querySelector(".is-value").textContent).toBe("30px");
        lumine.styles.addStyleSheet("lumine-workspace { --editor-line-height: normal; }", {
          sourcePath: "styleguide-line-height-spec",
          priority: 3,
        });
        styleGuideView.updateResolvedValues();
        expect(row.querySelector(".is-value").textContent).toBe("normal");
      } finally {
        stylesheet.dispose();
      }
    });

    it("refreshes accent labels when the system accent changes and is removed", async () => {
      jasmine.useRealClock();
      await waitForTextColorSwatch(styleGuideView);
      styleGuideView.updateResolvedValues();
      const label = styleGuideView.element.querySelector(
        '[data-var="accent-indicator-color"] > .is-value',
      );
      const originalValue = label.textContent;
      const originalSource = lumine.config.get("theme.accentSource");
      const originalAccent = lumine.themes.systemAccentColor;
      spyOn(lumine.themes.applicationDelegate, "invokeApp").and.returnValue(
        Promise.resolve("#123456"),
      );
      const themeSwitch = jasmine.createSpy("theme switch");
      const subscription = lumine.themes.onDidChangeActiveThemes(themeSwitch);
      try {
        lumine.config.set("theme.accentSource", "system");
        await lumine.themes.refreshSystemAccentColor();
        await conditionPromise(
          () => label.textContent === "rgb(18, 52, 86)",
          "initial accent label",
        );
        lumine.themes.systemAccentColor = "#654321";
        lumine.themes.applyAccentColor();
        await conditionPromise(
          () => label.textContent === "rgb(101, 67, 33)",
          "updated accent label",
        );
        lumine.config.set("theme.accentSource", "theme");
        lumine.themes.applyAccentColor();
        await conditionPromise(() => label.textContent === originalValue, "theme accent restored");
        expect(themeSwitch).not.toHaveBeenCalled();
      } finally {
        subscription.dispose();
        lumine.config.set("theme.accentSource", originalSource);
        lumine.themes.systemAccentColor = originalAccent;
        lumine.themes.applyAccentColor();
      }
    });

    it("does not auto-select an item in the showcase select list", async () => {
      jasmine.useRealClock();
      let liveExample;
      await conditionPromise(() => {
        const section = styleGuideView.element.querySelector('[data-name="select-list"]');
        liveExample = section?.querySelector(".example") ?? null;
        const rows = liveExample?.querySelectorAll(
          ".select-list .list-group > li:not(.select-list-separator)",
        );
        return rows?.length === 3;
      }, "the showcase select list and its rows to render");

      // A selected item would call scrollIntoViewIfNeeded and scroll the whole
      // styleguide down to this mid-page example on open.
      expect(liveExample.querySelector(".select-list .selected")).toBeNull();
    });

    it("labels each variable swatch with the active theme's resolved value", async () => {
      jasmine.useRealClock();
      const swatch = await waitForTextColorSwatch(styleGuideView);
      await conditionPromise(
        () => COLOR_PATTERN.test(swatch.querySelector(".is-value")?.textContent),
        "the active theme color to resolve",
      );
      const value = swatch.querySelector(".is-value");
      expect(value).not.toBeNull();
      // The active theme resolves --text-color to a concrete color.
      expect(value.textContent).toMatch(COLOR_PATTERN);
    });

    it("resolves variables when expanding a restored collapsed section", async () => {
      jasmine.useRealClock();
      await lumine.workspace.paneForItem(styleGuideView).destroyItem(styleGuideView, true);
      styleGuideView = lumine.packages
        .getActivePackage("styleguide")
        .mainModule.createStyleguideView({
          uri: "lumine://styleguide",
          collapsedSections: ["variables"],
        });
      lumine.workspace.getActivePane().addItem(styleGuideView);
      lumine.workspace.getActivePane().activateItem(styleGuideView);
      expect(textColorSwatch(styleGuideView)).toBeNull();

      await styleGuideView.expandAll();
      const swatch = await waitForTextColorSwatch(styleGuideView);
      await conditionPromise(
        () => COLOR_PATTERN.test(swatch.querySelector(".is-value")?.textContent),
        "the expanded section's values to resolve",
      );
      expect(swatch.querySelector(".is-value").textContent).toMatch(COLOR_PATTERN);
    });

    it("waits for a disconnected view to reconnect before resolving values", async () => {
      jasmine.useRealClock();
      const swatch = await waitForTextColorSwatch(styleGuideView);
      const originalParent = styleGuideView.element.parentNode;
      styleGuideView.cancelResolvedValuesSchedule();
      styleGuideView.element.remove();
      swatch.querySelector(".is-value")?.remove();

      styleGuideView.scheduleResolvedValues();
      expect(styleGuideView.connectionObserver instanceof MutationObserver).toBe(true);
      expect(swatch.querySelector(".is-value")).toBeNull();

      originalParent.appendChild(styleGuideView.element);
      await conditionPromise(
        () => COLOR_PATTERN.test(swatch.querySelector(".is-value")?.textContent),
        "the reconnected view's theme color to resolve",
      );
    });

    it("clears scheduled work and listeners idempotently on destroy", async () => {
      await waitForTextColorSwatch(styleGuideView);
      styleGuideView.cancelResolvedValuesSchedule();
      const cancel = spyOn(window, "cancelAnimationFrame");
      const disconnect = jasmine.createSpy("disconnect");
      styleGuideView.resolvedValuesFrame = 303;
      styleGuideView.connectionObserver = { disconnect };
      const schedule = spyOn(styleGuideView, "scheduleResolvedValues").and.callThrough();
      const heading = styleGuideView.element.querySelector(".section-toggle");

      styleGuideView.destroy();
      styleGuideView.destroy();
      heading.click();

      expect(cancel).toHaveBeenCalledWith(303);
      expect(disconnect).toHaveBeenCalled();
      expect(styleGuideView.resolvedValuesFrame).toBeNull();
      expect(styleGuideView.connectionObserver).toBeNull();
      expect(schedule).not.toHaveBeenCalled();
    });
  });
});
