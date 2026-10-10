"use client";

import { useEffect, useState } from "react";
import Comments from "@/plugins/comments/comments";
import "./preview.css";

export default function CommentsPreview() {
  const [origin, setOrigin] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [appearance, setAppearance] = useState<"minimal" | "panel">("minimal");
  const [lang, setLang] = useState("zh-CN");
  const [scenario, setScenario] = useState("normal");
  const [article, setArticle] = useState("standalone-comments-one");
  const [mounted, setMounted] = useState(true);
  const [accent, setAccent] = useState("");
  const [loading, setLoading] = useState<"manual" | "viewport">("viewport");
  const [login, setLogin] = useState<"optional" | "disabled">("disabled");
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setOrigin(location.origin);
      setLogin(
        new URL(location.href).searchParams.get("login") === "optional"
          ? "optional"
          : "disabled",
      );
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  function changeLogin(value: "optional" | "disabled") {
    const url = new URL(location.href);
    if (value === "optional") url.searchParams.set("login", value);
    else url.searchParams.delete("login");
    history.replaceState(history.state, "", url.href);
    setLogin(value);
  }
  return (
    <main className="preview" data-theme={theme}>
      <header className="previewNav">
        <h1>评论预览</h1>
        <span>演示数据</span>
      </header>
      <div className="previewLayout">
        <aside className="previewSettings" aria-label="预览设置">
          <fieldset>
            <legend>主题</legend>
            <div className="previewSwitch">
              <button
                aria-pressed={theme === "light"}
                onClick={() => setTheme("light")}
              >
                浅色
              </button>
              <button
                aria-pressed={theme === "dark"}
                onClick={() => setTheme("dark")}
              >
                深色
              </button>
            </div>
          </fieldset>
          <label>
            外观
            <select
              value={appearance}
              onChange={(event) =>
                setAppearance(event.target.value as typeof appearance)
              }
            >
              <option value="minimal">简洁</option>
              <option value="panel">面板</option>
            </select>
          </label>
          <label>
            语言
            <select
              value={lang}
              onChange={(event) => setLang(event.target.value)}
            >
              <option value="zh-CN">中文</option>
              <option value="en">English</option>
            </select>
          </label>
          <label>
            强调色
            <select
              value={accent}
              onChange={(event) => setAccent(event.target.value)}
            >
              <option value="">跟随主题</option>
              <option value="#33635b">松绿</option>
              <option value="#b46c42">陶土</option>
              <option value="#779ddd">雾蓝</option>
            </select>
          </label>
          <label>
            加载方式
            <select
              value={loading}
              onChange={(event) =>
                setLoading(event.target.value as typeof loading)
              }
            >
              <option value="viewport">进入视野加载</option>
              <option value="manual">点击加载</option>
            </select>
          </label>
          <label>
            账号登录
            <select
              value={login}
              onChange={(event) =>
                changeLogin(event.target.value as typeof login)
              }
            >
              <option value="optional">可选登录</option>
              <option value="disabled">仅访客</option>
            </select>
          </label>
          <label>
            演示状态
            <select
              aria-label="演示状态"
              value={scenario}
              onChange={(event) => setScenario(event.target.value)}
            >
              <option value="normal">正常评论</option>
              <option value="empty">还没有评论</option>
              <option value="error">加载失败，可重试</option>
              <option value="submit-error">提交失败，保留草稿</option>
              <option value="moderated">提交后等待审核</option>
            </select>
          </label>
          <label>
            独立文章
            <select
              aria-label="独立文章"
              value={article}
              onChange={(event) => setArticle(event.target.value)}
            >
              <option value="standalone-comments-one">文章 A</option>
              <option value="standalone-comments-two">文章 B</option>
            </select>
          </label>
          <button
            className="previewMount"
            onClick={() => setMounted((value) => !value)}
          >
            {mounted ? "卸载插件" : "挂载插件"}
          </button>
        </aside>
        <div className="previewStage">
          {origin && mounted && (
            <Comments
              key={`${loading}:${login}`}
              options={{
                provider: "waline",
                serverURL: `${origin}/service/${scenario}`,
                lang: lang as "zh-CN" | "en",
                theme,
                appearance,
                loading,
                ...(login === "optional" ? { login } : {}),
                pageSize: 3,
                ...(accent ? { accent } : {}),
              }}
              context={{
                locale: lang,
                article: {
                  id: article,
                  title: "Standalone comments",
                  href: "/",
                },
              }}
            />
          )}
        </div>
      </div>
    </main>
  );
}
