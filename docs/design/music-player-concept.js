(() => {
  const { defaults, themeAccents } = globalThis.musicConfiguration;
  const $ = (id) => document.getElementById(id);
  const player = $("music"),
    audio = $("audio"),
    progress = $("progress");
  const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
  let inView = true;
  const demoTracks = [
    {
      title: "Soft focus",
      artist: "Folio Sessions",
      duration: 214,
    },
    {
      title: "Blue hour",
      artist: "Folio Sessions",
      duration: 187,
    },
    {
      title: "Somewhere, slowly",
      artist: "Folio Sessions",
      duration: 246,
    },
  ];
  let tracks = demoTracks,
    index = 0,
    playing = false,
    playRequested = false,
    buffering = false,
    elapsed = 67,
    duration = 214,
    repeat = false;
  let timer = null,
    lastTick = 0,
    ownedUrls = [],
    coverUrl = null,
    requestVersion = 0;
  const isDemo = () => !tracks[index].src;
  const format = (seconds) =>
    `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  const current = () => tracks[index];
  const setMessage = (message = "") => {
    $("player-message").textContent = message;
    $("player-message").hidden = !message;
  };
  function updateProgress() {
    progress.disabled = duration <= 0;
    progress.max = duration || 1;
    progress.value = elapsed;
    progress.style.setProperty(
      "--progress",
      `${duration ? (elapsed / duration) * 100 : 0}%`,
    );
    progress.setAttribute(
      "aria-valuetext",
      `${format(elapsed)} / ${duration ? format(duration) : "未知时长"}`,
    );
    $("elapsed").textContent = format(elapsed);
    $("duration").textContent = duration ? format(duration) : "—:—";
  }
  function updateMotion() {
    player.dataset.inView = String(inView);
    player.dataset.motion = String(
      playing &&
        !buffering &&
        inView &&
        !document.hidden &&
        !motionPreference.matches,
    );
    $("notes-hint").textContent = motionPreference.matches
      ? "系统已开启减少动态效果：保留音符设置，当前不播放动画。"
      : "开启后，音符随播放轻轻上浮。尊重系统的减少动态效果设置。";
  }
  function updateStatus() {
    player.dataset.playing = String(playing);
    player.dataset.buffering = String(buffering);
    for (const button of player.querySelectorAll("[data-play]")) {
      button.setAttribute(
        "aria-label",
        playRequested ? "暂停" : isDemo() ? "演示播放" : "播放",
      );
      button.setAttribute("aria-pressed", String(playRequested));
      button.title = buffering
        ? "正在缓冲，点击暂停"
        : button.getAttribute("aria-label");
      button
        .querySelector("use")
        .setAttribute("href", playRequested ? "#i-pause" : "#i-play");
    }
    $("now-label").textContent = playing
      ? isDemo()
        ? "SILENT PREVIEW"
        : "NOW PLAYING"
      : "READY WHEN YOU ARE";
    if (buffering) $("now-label").textContent = "正在缓冲";
    updateMotion();
    clearInterval(timer);
    timer = null;
    if (playing && isDemo() && !document.hidden) {
      lastTick = performance.now();
      timer = setInterval(() => {
        const now = performance.now();
        elapsed = Math.min(duration, elapsed + (now - lastTick) / 1000);
        lastTick = now;
        updateProgress();
        if (elapsed >= duration) select(repeat ? index : index + 1, true);
      }, 250);
    }
  }
  async function play() {
    setMessage();
    playRequested = true;
    buffering = !isDemo();
    if (isDemo()) {
      playing = true;
      updateStatus();
      return;
    }
    updateStatus();
    const version = ++requestVersion;
    try {
      if (audio.error) audio.load();
      await audio.play();
    } catch (error) {
      if (version !== requestVersion || error.name === "AbortError") return;
      playing = false;
      playRequested = false;
      buffering = false;
      updateStatus();
      setMessage("无法播放这首音乐。请检查文件或直链，然后重试。");
    }
  }
  function pause() {
    requestVersion++;
    playRequested = false;
    buffering = false;
    audio.pause();
    playing = false;
    updateStatus();
  }
  function renderQueue() {
    $("queue").replaceChildren(
      ...tracks.map((track, itemIndex) => {
        const li = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.setAttribute("aria-current", String(itemIndex === index));
        button.setAttribute("aria-label", `播放 ${track.title}`);
        const number = document.createElement("span");
        number.className = "number";
        number.textContent = String(itemIndex + 1).padStart(2, "0");
        const label = document.createElement("span");
        label.className = "track-label";
        label.textContent = track.title;
        const artist = document.createElement("small");
        artist.textContent = track.artist;
        label.append(artist);
        button.append(number, label);
        button.addEventListener("click", () => {
          select(itemIndex, true);
          togglePanel("queue", false);
          $("queue-toggle").focus();
        });
        li.append(button);
        return li;
      }),
    );
    $("queue-count").textContent = `${tracks.length} 首`;
  }
  function select(next, resume = playRequested) {
    pause();
    index = (next + tracks.length) % tracks.length;
    elapsed = 0;
    duration = current().duration || 0;
    $("song-title").textContent = current().title;
    $("song-title").title = current().title;
    $("artist").textContent = current().artist;
    if (current().src) audio.src = current().src;
    else {
      audio.removeAttribute("src");
      audio.load();
    }
    setMessage();
    updateProgress();
    renderQueue();
    $("previous").disabled = tracks.length < 2;
    $("next").disabled = tracks.length < 2;
    updateStatus();
    if (resume) void play();
  }
  function positionPanel() {
    if (!player.dataset.panel) return;
    const stage = $("stage").getBoundingClientRect();
    const bounds = player.getBoundingClientRect();
    const above = bounds.top - stage.top - 20;
    const below = stage.bottom - bounds.bottom - 20;
    const useBelow = above < 180 && below > above;
    player.dataset.panelSide = useBelow ? "below" : "above";
    player.style.setProperty(
      "--panel-height",
      `${Math.min(250, Math.max(80, useBelow ? below : above))}px`,
    );
  }
  function togglePanel(name, force, moveFocus = false) {
    const panel = $(`${name}-panel`);
    const open = force ?? panel.hidden;
    if (open) player.dataset.panel = name;
    else delete player.dataset.panel;
    for (const other of ["queue", "volume"]) {
      $(`${other}-panel`).hidden = other !== name || !open;
      $(`${other}-toggle`).setAttribute(
        "aria-expanded",
        String(other === name && open),
      );
    }
    if (open) {
      positionPanel();
      if (moveFocus) {
        const target =
          name === "volume"
            ? $("volume")
            : panel.querySelector('[aria-current="true"]');
        target?.focus({ preventScroll: true });
      }
    }
    setMessage();
  }
  function expand(value, moveFocus = false) {
    player.dataset.expanded = String(value);
    const retracted = player.dataset.position === "center" && !value;
    $("shell").inert = retracted;
    $("reveal-control").setAttribute("aria-hidden", String(!retracted));
    $("reveal-control").setAttribute("aria-expanded", String(value));
    $("reveal-control").tabIndex = retracted ? 0 : -1;
    $("metadata").inert = !value;
    $("transport").inert = !value;
    $("record-control").setAttribute("aria-expanded", String(value));
    $("record-control").setAttribute(
      "aria-label",
      value ? "收起播放器" : "展开播放器",
    );
    $("record-control").title = value ? "收起播放器" : "展开播放器";
    if (!value) togglePanel("queue", false);
    if (moveFocus)
      $(retracted ? "reveal-control" : "record-control").focus({
        preventScroll: true,
      });
  }
  for (const button of player.querySelectorAll("[data-play]"))
    button.addEventListener("click", () =>
      playRequested ? pause() : void play(),
    );
  $("previous").addEventListener("click", () => select(index - 1));
  $("next").addEventListener("click", () => select(index + 1));
  $("repeat").addEventListener("click", () => {
    repeat = !repeat;
    audio.loop = repeat;
    $("repeat").setAttribute("aria-pressed", String(repeat));
  });
  $("record-control").addEventListener("click", () =>
    expand(player.dataset.expanded !== "true", true),
  );
  $("reveal-control").addEventListener("click", () => expand(true, true));
  $("queue-toggle").addEventListener("click", () =>
    togglePanel("queue", undefined, true),
  );
  $("volume-toggle").addEventListener("click", () =>
    togglePanel("volume", undefined, true),
  );
  player.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!$("queue-panel").hidden || !$("volume-panel").hidden) {
      const active = !$("queue-panel").hidden ? "queue" : "volume";
      togglePanel(active, false);
      $(`${active}-toggle`).focus();
    } else expand(false, true);
    event.stopPropagation();
  });
  document.addEventListener("pointerdown", (event) => {
    if (!player.contains(event.target)) togglePanel("queue", false);
  });
  document.addEventListener("focusin", (event) => {
    const open = player.dataset.panel;
    if (
      open &&
      !$(`${open}-panel`).contains(event.target) &&
      event.target !== $(`${open}-toggle`)
    ) {
      togglePanel(open, false);
    }
  });
  const panelObserver = new ResizeObserver(positionPanel);
  panelObserver.observe($("stage"));
  progress.addEventListener("input", () => {
    elapsed = Number(progress.value);
    if (!isDemo() && audio.readyState >= 1) {
      try {
        audio.currentTime = elapsed;
      } catch {
        setMessage("当前音频暂时无法跳转，请稍后重试。");
      }
    }
    updateProgress();
  });
  $("volume").addEventListener("input", (event) => {
    audio.volume = Number(event.target.value);
    $("volume-value").value = `${Math.round(audio.volume * 100)}%`;
    event.target.style.setProperty("--progress", `${audio.volume * 100}%`);
  });
  audio.volume = defaults.volume;
  $("volume").value = defaults.volume;
  $("volume").dispatchEvent(new Event("input"));
  audio.addEventListener("playing", () => {
    if (isDemo() || audio.paused) return;
    playing = true;
    playRequested = true;
    buffering = false;
    setMessage();
    updateStatus();
  });
  audio.addEventListener("pause", () => {
    if (!isDemo() && audio.paused) {
      playing = false;
      playRequested = false;
      buffering = false;
      updateStatus();
    }
  });
  audio.addEventListener("waiting", () => {
    if (!isDemo() && playRequested) {
      buffering = true;
      updateStatus();
    }
  });
  audio.addEventListener("timeupdate", () => {
    if (!isDemo()) {
      elapsed = audio.currentTime;
      updateProgress();
    }
  });
  audio.addEventListener("durationchange", () => {
    if (!isDemo()) {
      duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      updateProgress();
    }
  });
  audio.addEventListener("ended", () => {
    if (tracks.length > 1 || repeat) select(repeat ? index : index + 1, true);
    else pause();
  });
  audio.addEventListener("error", () => {
    if (!isDemo()) {
      playing = false;
      playRequested = false;
      buffering = false;
      updateStatus();
      setMessage("音频加载失败。请更换文件或检查直链。");
    }
  });
  document.querySelectorAll("[data-setting]").forEach((group) =>
    group.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-value]");
      if (!button) return;
      const setting = group.dataset.setting,
        value = button.dataset.value;
      togglePanel("queue", false);
      player.dataset[setting] = value;
      expand(player.dataset.expanded === "true");
      if (setting === "position")
        $("mode-title").textContent =
          value === "center" ? "底部居中模式" : "右下角悬浮模式";
      group
        .querySelectorAll("button")
        .forEach((item) =>
          item.setAttribute("aria-pressed", String(item === button)),
        );
      if (setting === "finish") {
        $("finish-name").textContent = {
          graphite: "石墨黑",
          porcelain: "纯白",
          cobalt: "深灰蓝",
        }[value];
        const color = themeAccents[value];
        $("accent").value = color;
        setAccent(color);
      }
      $("interaction-caption").textContent =
        `${player.dataset.position === "center" ? "底部居中 · 点击最左侧唱片下滑收起，点击底部双箭头唤回。" : "右下角悬浮 · 点击最左侧唱片／封面展开或收起。"}`;
    }),
  );
  function setAccent(color) {
    player.style.setProperty("--accent", color);
  }
  $("accent").addEventListener("input", (event) =>
    setAccent(event.target.value),
  );
  $("notes-enabled").addEventListener("change", (event) => {
    player.dataset.notes = String(event.target.checked);
    $("note-palette").hidden = !event.target.checked;
  });
  document.querySelectorAll("[data-note-color]").forEach((input) => {
    input.value = defaults.notes.colors[Number(input.dataset.noteColor) - 1];
    input.addEventListener("input", () => {
      player.style.setProperty(
        `--note-color-${input.dataset.noteColor}`,
        input.value,
      );
    });
    input.dispatchEvent(new Event("input"));
  });
  for (const [setting, value] of Object.entries({
    skin: defaults.skin,
    position: defaults.position === "bottom" ? "center" : "right",
    finish: defaults.theme,
  }))
    document
      .querySelector(`[data-setting="${setting}"] [data-value="${value}"]`)
      .click();
  expand(defaults.initialExpanded);
  $("notes-enabled").checked = defaults.notes.enabled;
  $("notes-enabled").dispatchEvent(new Event("change"));
  motionPreference.addEventListener("change", updateMotion);
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    updateMotion();
  });
  visibilityObserver.observe(player);
  function releaseAudio() {
    pause();
    audio.removeAttribute("src");
    audio.load();
    ownedUrls.forEach((url) => URL.revokeObjectURL(url));
    ownedUrls = [];
  }
  $("import-audio").addEventListener("click", () => $("audio-files").click());
  $("audio-files").addEventListener("change", (event) => {
    const files = [...event.target.files];
    if (!files.length) return;
    releaseAudio();
    tracks = files.map((file) => {
      const src = URL.createObjectURL(file);
      ownedUrls.push(src);
      return {
        title: file.name.replace(/\.[^.]+$/, ""),
        artist: "本地音乐 · 仅本机读取",
        src,
      };
    });
    select(0, false);
    expand(true);
    $("source-status").textContent =
      `已载入 ${tracks.length} 首本地音乐。点击播放开始试听，文件不会上传。`;
    event.target.value = "";
  });
  $("url-form").addEventListener("submit", (event) => {
    event.preventDefault();
    let url;
    try {
      url = new URL($("audio-url").value);
    } catch {
      /* Handled by the validation below. */
    }
    if (!url || url.protocol !== "https:" || url.username || url.password) {
      $("source-status").textContent = "请使用不含账号密码的 HTTPS 音频直链。";
      return;
    }
    releaseAudio();
    tracks = [
      { title: "Your soundtrack", artist: url.hostname, src: url.href },
    ];
    select(0, false);
    expand(true);
    $("source-status").textContent =
      "已载入直链。点击播放后会向该音频服务器发送请求。";
  });
  $("import-cover").addEventListener("click", () => $("cover-file").click());
  $("cover-file").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (coverUrl) URL.revokeObjectURL(coverUrl);
    coverUrl = URL.createObjectURL(file);
    player.style.setProperty("--art", `url("${coverUrl}")`);
    event.target.value = "";
  });
  $("reset-demo").addEventListener("click", () => {
    releaseAudio();
    tracks = demoTracks;
    select(0, false);
    elapsed = 67;
    duration = 214;
    updateProgress();
    if (coverUrl) {
      URL.revokeObjectURL(coverUrl);
      coverUrl = null;
    }
    player.style.removeProperty("--art");
    $("source-status").textContent =
      "当前为静音交互演示。导入后可真实播放；文件仅在本机读取，不上传。";
  });
  document.addEventListener("visibilitychange", () => {
    player.dataset.hidden = String(document.hidden);
    updateStatus();
  });
  window.addEventListener("pagehide", (event) => {
    pause();
    // A page in the back/forward cache still owns these Blob URLs.
    if (event.persisted) return;
    visibilityObserver.disconnect();
    panelObserver.disconnect();
    motionPreference.removeEventListener("change", updateMotion);
    ownedUrls.forEach((url) => URL.revokeObjectURL(url));
    if (coverUrl) URL.revokeObjectURL(coverUrl);
  });
  window.addEventListener("pageshow", () => {
    player.dataset.hidden = String(document.hidden);
    updateStatus();
  });
  renderQueue();
  updateProgress();
  updateStatus();
})();
