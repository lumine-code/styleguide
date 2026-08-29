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
      await lumine.views.getNextUpdatePromise();

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

    it("waits for a detached view to connect before resolving variable values", async () => {
      jasmine.useRealClock();
      const swatch = await waitForTextColorSwatch(styleGuideView);
      const originalParent = styleGuideView.element.parentNode;
      styleGuideView.cancelResolvedValuesSchedule();
      styleGuideView.element.remove();
      swatch.querySelector(".is-value")?.remove();

      styleGuideView.scheduleResolvedValues();
      expect(styleGuideView.connectionObserver instanceof window.MutationObserver).toBe(true);
      await new Promise((resolve) => window.requestAnimationFrame(resolve));

      expect(swatch.querySelector(".is-value")).toBeNull();
      originalParent.appendChild(styleGuideView.element);
      await conditionPromise(
        () => COLOR_PATTERN.test(swatch.querySelector(".is-value")?.textContent),
        "the connected view's theme color to resolve",
      );
    });

    it("re-checks connection after installing its observer", async () => {
      jasmine.useRealClock();
      await waitForTextColorSwatch(styleGuideView);
      const originalParent = styleGuideView.element.parentNode;
      styleGuideView.cancelResolvedValuesSchedule();
      styleGuideView.element.remove();
      const NativeMutationObserver = window.MutationObserver;
      spyOn(window, "MutationObserver").and.callFake(function (callback) {
        const observer = new NativeMutationObserver(callback);
        const observe = observer.observe.bind(observer);
        observer.observe = (target, options) => {
          originalParent.appendChild(styleGuideView.element);
          observe(target, options);
        };
        return observer;
      });

      styleGuideView.scheduleResolvedValues();

      expect(styleGuideView.connectionObserver).toBeNull();
      await conditionPromise(
        () =>
          COLOR_PATTERN.test(
            textColorSwatch(styleGuideView)?.querySelector(".is-value")?.textContent,
          ),
        "the view connected during observer installation to resolve",
      );
    });

    it("ignores a stale source frame and resolves values in the destination realm", async () => {
      jasmine.useRealClock();
      const swatch = await waitForTextColorSwatch(styleGuideView);
      await conditionPromise(
        () => COLOR_PATTERN.test(swatch.querySelector(".is-value")?.textContent),
        "the source theme color to resolve",
      );
      const sourceValue = swatch.querySelector(".is-value").textContent;
      const originalParent = styleGuideView.element.parentNode;
      const frame = document.createElement("iframe");
      jasmine.attachToDOM(frame);
      const destinationDocument = frame.contentDocument;
      const destinationWindow = frame.contentWindow;
      const destinationValue = "rgb(12, 34, 56)";
      destinationDocument.documentElement.style.setProperty("--text-color", destinationValue);
      expect(sourceValue).not.toBe(destinationValue);

      let sourceFrameCallback;
      let destinationFrameCallback;
      spyOn(window, "requestAnimationFrame").and.callFake((callback) => {
        sourceFrameCallback = callback;
        return 101;
      });
      spyOn(window, "cancelAnimationFrame");
      spyOn(destinationWindow, "requestAnimationFrame").and.callFake((callback) => {
        destinationFrameCallback = callback;
        return 202;
      });
      spyOn(destinationWindow, "cancelAnimationFrame");
      spyOn(destinationWindow, "getComputedStyle").and.callThrough();

      try {
        styleGuideView.scheduleResolvedValues();
        expect(sourceFrameCallback).toEqual(jasmine.any(Function));
        const transition = styleGuideView.beginWindowSurfaceTransition();
        expect(window.cancelAnimationFrame).toHaveBeenCalledWith(101);
        destinationDocument.adoptNode(styleGuideView.element);
        destinationDocument.body.appendChild(styleGuideView.element);

        sourceFrameCallback();
        expect(swatch.querySelector(".is-value").textContent).toBe(sourceValue);
        await transition.commit();
        expect(destinationFrameCallback).toEqual(jasmine.any(Function));
        destinationFrameCallback();
        expect(swatch.querySelector(".is-value").textContent).toBe(destinationValue);
        expect(destinationWindow.getComputedStyle).toHaveBeenCalled();
      } finally {
        if (styleGuideView.element.ownerDocument !== document) {
          const restore = styleGuideView.beginWindowSurfaceTransition();
          document.adoptNode(styleGuideView.element);
          originalParent.appendChild(styleGuideView.element);
          await restore.commit();
          sourceFrameCallback?.();
        }
        frame.remove();
      }
    });

    it("clears realm work and listeners idempotently on destroy", async () => {
      await waitForTextColorSwatch(styleGuideView);
      styleGuideView.cancelResolvedValuesSchedule();
      const cancelAnimationFrame = jasmine
        .createSpy("cancelAnimationFrame")
        .and.throwError("realm closed");
      const disconnect = jasmine.createSpy("disconnect");
      styleGuideView.resolvedValuesFrame = 303;
      styleGuideView.resolvedValuesFrameWindow = { closed: false, cancelAnimationFrame };
      styleGuideView.connectionObserver = { disconnect };
      const schedule = spyOn(styleGuideView, "scheduleResolvedValues").and.callThrough();
      const heading = styleGuideView.element.querySelector(".section-heading");

      expect(() => styleGuideView.destroy()).not.toThrow();
      expect(() => styleGuideView.destroy()).not.toThrow();
      heading.click();

      expect(cancelAnimationFrame).toHaveBeenCalledWith(303);
      expect(disconnect).toHaveBeenCalled();
      expect(styleGuideView.resolvedValuesFrame).toBeNull();
      expect(styleGuideView.resolvedValuesFrameWindow).toBeNull();
      expect(styleGuideView.connectionObserver).toBeNull();
      expect(schedule).not.toHaveBeenCalled();
    });

    it("tolerates its owner realm closing while work is being scheduled", async () => {
      await waitForTextColorSwatch(styleGuideView);
      const originalParent = styleGuideView.element.parentNode;
      styleGuideView.cancelResolvedValuesSchedule();
      spyOn(window, "requestAnimationFrame").and.throwError("realm closed before frame request");

      expect(() => styleGuideView.scheduleResolvedValues()).not.toThrow();
      expect(styleGuideView.resolvedValuesFrame).toBeNull();
      expect(styleGuideView.resolvedValuesFrameWindow).toBeNull();

      styleGuideView.element.remove();
      spyOn(window, "MutationObserver").and.throwError("realm closed before observer creation");
      expect(() => styleGuideView.scheduleResolvedValues()).not.toThrow();
      expect(styleGuideView.connectionObserver).toBeNull();
      originalParent.appendChild(styleGuideView.element);
    });
  });
});
