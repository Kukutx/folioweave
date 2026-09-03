export const FIXED_NOW = Date.parse("2026-09-02T16:00:00.000Z");

export async function prepareVisualContext(context) {
  await context.addInitScript(({ fixedNow }) => {
    const NativeDate = Date;
    class FixedDate extends NativeDate {
      constructor(...args) {
        super(...(args.length ? args : [fixedNow]));
      }
      static now() {
        return fixedNow;
      }
    }
    Object.setPrototypeOf(FixedDate, NativeDate);
    window.Date = FixedDate;

    let seed = 123456789;
    Math.random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }, { fixedNow: FIXED_NOW });

  await context.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.includes("api.open-meteo.com/v1/forecast")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          current: { temperature_2m: 24.2, weather_code: 3, is_day: 0 },
        }),
      });
    }
    if (/\/api\/weather(?:\?|$)/.test(url)) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          temperature: 24.2,
          weatherCode: 3,
          isDay: false,
        }),
      });
    }
    return route.continue();
  });
}

export async function waitForRenderableAssets(page) {
  await page.waitForFunction(
    () => (document.body.innerText || "").trim().length > 20,
    undefined,
    { timeout: 10_000 },
  );

  await page.evaluate(async () => {
    await document.fonts.ready;
    const eagerImages = [...document.images].filter(
      (image) => image.loading !== "lazy" || image.complete,
    );
    await Promise.all(
      eagerImages.map(async (image) => {
        if (!image.complete) {
          await new Promise((resolve) => {
            image.addEventListener("load", resolve, { once: true });
            image.addEventListener("error", resolve, { once: true });
          });
        }
        if (image.naturalWidth > 0) {
          try {
            await image.decode();
          } catch {}
        }
      }),
    );
  });
}

function freezeScript(currentRoute) {
  if (currentRoute === "/") {
    const hideDynamicOverlays = (root = document.body) => {
      const candidates =
        root instanceof HTMLElement
          ? [root, ...root.querySelectorAll("*")]
          : [...document.querySelectorAll("body *")];

      for (const element of candidates) {
        if (!(element instanceof HTMLElement)) continue;
        const style = getComputedStyle(element);
        const z = Number.parseInt(style.zIndex || "0", 10);
        if (
          (style.position === "fixed" || style.position === "absolute") &&
          [15000, 19000, 30000].includes(z)
        ) {
          element.style.setProperty("visibility", "hidden", "important");
        }
      }
    };

    hideDynamicOverlays();
    if (!window.__visualFreezeObserver) {
      window.__visualFreezeObserver = new MutationObserver((records) => {
        for (const record of records) {
          if (record.target instanceof HTMLElement) {
            hideDynamicOverlays(record.target);
          }
          for (const node of record.addedNodes) {
            if (node instanceof HTMLElement) hideDynamicOverlays(node);
          }
        }
      });
      window.__visualFreezeObserver.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["style"],
      });
    }

    const greeting = document.querySelector(".hero-greeting > span");
    if (greeting instanceof HTMLElement) {
      greeting.style.setProperty("visibility", "hidden", "important");
    }

    const firstDot = document.querySelector(".notchshelf-carousel-dot");
    if (firstDot instanceof HTMLElement) firstDot.click();

    for (const element of document.querySelectorAll(".hero-title, .hero-bio p")) {
      if (!(element instanceof HTMLElement)) continue;
      element.style.removeProperty("transform");
      element.style.removeProperty("transition");
    }

    hideDynamicOverlays();
  }

  if (currentRoute === "/district") {
    const contact = document.querySelector(".contact-btn");
    if (contact instanceof HTMLElement) contact.style.display = "none";

    // The badge PNG itself is SHA-256 verified by qa:assets. Its 55px render
    // starts at a fractional x coordinate and can differ by a few filtered edge
    // pixels between otherwise identical Chromium surfaces, so visual parity
    // verifies its layout box while asset QA verifies the pixels.
    const badge = document.querySelector(".case-study-badge-icon");
    if (badge instanceof HTMLElement) badge.style.visibility = "hidden";
  }

  if (currentRoute === "/blogs") {
    // The blog hero WebP is SHA-256 verified by qa:assets. At 388×241.75px,
    // Chromium filtering can vary by a few pixels between separate surfaces.
    // Keep its layout box while asset QA owns binary pixel identity.
    const cardImage = document.querySelector(".blog-card-image img");
    if (cardImage instanceof HTMLElement) cardImage.style.visibility = "hidden";

    for (const selector of [
      ".writing-header > div",
      ".writing-title",
      ".writing-subtitle",
      ".blogs-grid",
      ".blogs-grid > div",
    ]) {
      for (const element of document.querySelectorAll(selector)) {
        if (!(element instanceof HTMLElement)) continue;
        element.style.opacity = "1";
        element.style.transform = "none";
      }
    }
  }
}

export async function freezeVisualState(page, route) {
  await page.evaluate(freezeScript, route);
  await page.waitForTimeout(route === "/" ? 550 : 50);

  await page.addStyleTag({
    content:
      "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}.hero-greeting>span{visibility:hidden!important}.hero-title,.hero-bio p{transform:none!important;transition:none!important}[style*=\"z-index: 15000\"],[style*=\"z-index:15000\"],[style*=\"z-index: 19000\"],[style*=\"z-index:19000\"],[style*=\"z-index: 30000\"],[style*=\"z-index:30000\"]{visibility:hidden!important}.writing-header>div,.writing-title,.writing-subtitle,.blogs-grid,.blogs-grid>div{opacity:1!important;transform:none!important}",
  });

  await page.evaluate(freezeScript, route);
  await page.waitForTimeout(100);
}
