const COLOR_PATTERN = /^(rgb|rgba|color|oklch|lab|lch|hsl)/;

function textColorSwatch(styleGuideView) {
  return styleGuideView.element.querySelector(
    '[data-name="variables"] .is-color[data-var="text-color"]',
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
      expect(te.getGrammar()?.scopeName).toBe("text.plain.null-grammar");

      await lumine.packages.activatePackage("language-html");
      await conditionPromise(
        () => te.getGrammar()?.scopeName === "text.html.basic",
        "the HTML grammar to be assigned",
      );

      expect(te.getGrammar()?.scopeName).toBe("text.html.basic");
    });

    it("documents both the classic and extended theme variables", async () => {
      jasmine.useRealClock();
      await waitForTextColorSwatch(styleGuideView);
      const variableNames = Array.from(
        styleGuideView.element.querySelectorAll('[data-name="variables"] [data-var]'),
      ).map((el) => el.dataset.var);

      // Classic contract
      expect(variableNames).toContain("text-color");
      expect(variableNames).toContain("component-padding");
      // Extended contract added by the CSS custom-property migration
      expect(variableNames).toContain("accent-bg-color");
      expect(variableNames).toContain("text-color-on-info");
      expect(variableNames).toContain("level-1-color");
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
      const heading = styleGuideView.element.querySelector(".section-heading");

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
