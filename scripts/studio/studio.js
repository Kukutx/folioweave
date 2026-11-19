const token = document.querySelector('meta[name="studio-token"]').content;
const zh = navigator.language.toLowerCase().startsWith("zh");
const text = zh
  ? {
      title: "FolioWeave 工作台",
      intro: "选一个你喜欢的样子。预览用的是你自己的内容，点“使用”之前什么都不会改。",
      personal: "个人网站",
      store: "商店",
      plugins: "插件",
      current: "当前",
      preview: "用我的内容预览",
      use: "使用这个模板",
      useSample: "使用（先填入示例店铺资料）",
      needs: (blocks) =>
        `需要 ${blocks.map(name).join("、")}；你的资料里还没有。`,
      starting: (n) => `正在启动 ${n} 的预览…第一次打开大约要 15 秒。`,
      ready: (n) => `${n} 的预览好了：`,
      openPreview: "打开预览 ↗",
      stopPreview: "停止预览",
      saved: "已保存。重启 npm run dev 后，你的网站就会用上它。",
      failed: "没有成功：",
      confirmUse: (n) => `把网站换成 ${n}？内容和其他模板的设置都会保留。`,
      confirmSample: (n) =>
        `${n} 需要店铺资料。先把示例资料填进你的 portfolio.json，之后再改成你自己的？`,
    }
  : {
      title: "FolioWeave Studio",
      intro:
        "Choose how your site looks. Previews use your own content and change nothing until you apply a template.",
      personal: "Personal sites",
      store: "Stores",
      plugins: "Plugins",
      current: "Current",
      preview: "Preview with my content",
      use: "Use this template",
      useSample: "Use, starting from sample shop details",
      needs: (blocks) =>
        `Needs ${blocks.map(name).join(", ")}, which your profile does not have yet.`,
      starting: (n) =>
        `Starting a preview of ${n}… the first load takes about 15 seconds.`,
      ready: (n) => `The preview of ${n} is ready: `,
      openPreview: "Open preview ↗",
      stopPreview: "Stop preview",
      saved: "Saved. Restart npm run dev to see it on your site.",
      failed: "That did not work: ",
      confirmUse: (n) =>
        `Switch the site to ${n}? Your content and other templates' settings are kept.`,
      confirmSample: (n) =>
        `${n} needs shop details. Add the sample details to your portfolio.json now, to replace with your own later?`,
    };
function name(block) {
  const names = zh ? { store: "店铺资料", photography: "摄影", footerBook: "页脚书摘", interlude: "插曲" } : { store: "shop details", photography: "photography", footerBook: "a footer book", interlude: "an interlude" };
  return names[block] ?? block;
}

for (const element of document.querySelectorAll("[data-text]")) {
  const value = text[element.dataset.text];
  if (typeof value === "string") element.textContent = value;
}
document.documentElement.lang = zh ? "zh-CN" : "en";
document.title = text.title;

let state;
/** Gallery text in the browser's language when a manifest offers it. */
const language = navigator.language;
function localize(next) {
  const pick = (item) => {
    const t =
      item.translations?.[language] ??
      item.translations?.[language.split("-")[0]];
    return { ...item, name: t?.name ?? item.name, description: t?.description ?? item.description };
  };
  return { ...next, templates: next.templates.map(pick), plugins: next.plugins.map(pick) };
}
let category = "personal";
let busy = false;
let watching = null;
const status = document.getElementById("status");

function say(message, { kind = "info", link } = {}) {
  status.hidden = false;
  status.dataset.kind = kind;
  status.textContent = message;
  if (link) {
    const anchor = document.createElement("a");
    anchor.href = link;
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    anchor.textContent = text.openPreview;
    status.append(anchor);
    const stop = document.createElement("button");
    stop.type = "button";
    stop.className = "stop";
    stop.textContent = text.stopPreview;
    stop.addEventListener("click", async () => {
      state = localize(await post("/api/preview/stop"));
      status.hidden = true;
      render();
    });
    status.append(stop);
  }
}

async function post(path, body = {}) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "X-Studio-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}

async function load() {
  const response = await fetch("/api/state");
  state = localize(await response.json());
  render();
  followPreview();
}

function render() {
  for (const tab of document.querySelectorAll("[role=tab]")) {
    const count = state.templates.filter(
      (template) => template.category === tab.dataset.category,
    ).length;
    tab.querySelector(".count").textContent = String(count);
    tab.hidden = count === 0;
    tab.setAttribute("aria-selected", String(tab.dataset.category === category));
  }
  document
    .getElementById("grid")
    .setAttribute("aria-labelledby", `tab-${category}`);
  const grid = document.getElementById("grid");
  const card = document.getElementById("card");
  grid.replaceChildren(
    ...state.templates
      .filter((template) => template.category === category)
      .map((template, index) => {
        const item = card.content.firstElementChild.cloneNode(true);
        item.dataset.current = String(template.current);
        const thumb = item.querySelector(".thumb");
        if (template.preview) {
          thumb.dataset.image = "";
          thumb.style.backgroundImage = `url("${template.preview}")`;
          thumb.setAttribute("role", "img");
          thumb.setAttribute("aria-label", template.name);
        } else item.querySelector(".placeholder").textContent = template.name;
        item.querySelector(".idx").textContent = String(index + 1).padStart(2, "0");
        item.querySelector(".name").textContent = template.name;
        item.querySelector(".current").textContent = text.current;
        item.querySelector(".tag").textContent = template.description;
        item.querySelector(".needs").textContent = template.missing.length
          ? text.needs(template.missing)
          : "";
        const preview = item.querySelector(".preview");
        preview.textContent = text.preview;
        preview.disabled = busy;
        preview.addEventListener("click", () => openPreview(template));
        const use = item.querySelector(".use");
        const needsSample = template.missing.length > 0;
        use.textContent = needsSample && template.sample ? text.useSample : text.use;
        use.disabled =
          busy || template.current || (needsSample && !template.sample);
        use.addEventListener("click", () => useTemplate(template));
        return item;
      }),
  );
  const list = document.getElementById("plugins");
  const row = document.getElementById("plugin");
  list.replaceChildren(
    ...state.plugins.map((plugin) => {
      const item = row.content.firstElementChild.cloneNode(true);
      item.querySelector(".plugin-name").textContent = plugin.name;
      item.querySelector(".plugin-description").textContent = plugin.description;
      const toggle = item.querySelector(".switch");
      toggle.setAttribute("aria-checked", String(plugin.enabled));
      toggle.setAttribute("aria-label", plugin.name);
      toggle.disabled = busy;
      toggle.addEventListener("click", () => setPlugin(plugin));
      return item;
    }),
  );
}

async function run(action) {
  busy = true;
  render();
  try {
    state = localize(await action());
    return true;
  } catch (error) {
    say(text.failed + error.message, { kind: "error" });
    return false;
  } finally {
    busy = false;
    render();
  }
}

async function useTemplate(template) {
  const withSample = template.missing.length > 0;
  if (!confirm(withSample ? text.confirmSample(template.name) : text.confirmUse(template.name)))
    return;
  if (await run(() => post(`/api/template/${template.id}/use`, { withSample })))
    say(text.saved);
}

async function setPlugin(plugin) {
  const verb = plugin.enabled ? "disable" : "enable";
  if (await run(() => post(`/api/plugin/${plugin.id}/${verb}`))) say(text.saved);
}

async function openPreview(template) {
  say(text.starting(template.name));
  if (await run(() => post(`/api/template/${template.id}/preview`)))
    followPreview();
}

/** Poll the one running preview until it answers, then offer its link. */
function followPreview() {
  clearTimeout(watching);
  const current = state.preview;
  const label = (id) => state.templates.find((item) => item.id === id)?.name ?? id;
  if (state.previewError) {
    say(text.failed + state.previewError, { kind: "error" });
    return;
  }
  if (!current) return;
  if (current.ready) {
    say(text.ready(label(current.template)), { link: current.url });
    return;
  }
  say(text.starting(label(current.template)));
  watching = setTimeout(async () => {
    state = localize(await (await fetch("/api/state")).json());
    followPreview();
  }, 1500);
}

for (const tab of document.querySelectorAll("[role=tab]"))
  tab.addEventListener("click", () => {
    category = tab.dataset.category;
    render();
  });

await load();
