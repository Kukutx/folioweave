import assert from "node:assert/strict";
import test from "node:test";
import {
  DEMO_ONLY_ROUTES,
  resolveDisabledDemoRoutes,
  resolvePublishedRoutes,
} from "../src/portfolio/publication-policy.mjs";

test("demo routes and blog routes are published once", () => {
  const routes = resolvePublishedRoutes({
    demoRoutesEnabled: true,
    blogRoutes: ["/blogs/clipt", "/blogs/example"],
  });
  assert.equal(routes.filter((route) => route === "/blogs/clipt").length, 1);
  assert.ok(routes.includes("/blogs"));
  assert.ok(routes.includes("/district"));
});

test("personal publishing excludes demos without hiding Markdown blogs", () => {
  const blogRoutes = ["/blogs/example"];
  const published = resolvePublishedRoutes({ demoRoutesEnabled: false, blogRoutes });
  const disabled = resolveDisabledDemoRoutes({ demoRoutesEnabled: false, blogRoutes });
  assert.deepEqual(published, ["/", "/blogs", "/blogs/example"]);
  assert.ok(DEMO_ONLY_ROUTES.every((route) => disabled.includes(route)));
  assert.ok(!disabled.includes("/blogs"));
});

test("empty personal blogs disable the index route", () => {
  assert.ok(
    resolveDisabledDemoRoutes({ demoRoutesEnabled: false, blogRoutes: [] }).includes(
      "/blogs",
    ),
  );
});
