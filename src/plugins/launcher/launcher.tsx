"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { House } from "lucide-react";
import type { PluginProps } from "@/core/contracts";
import {
  claimFloatingPanel,
  useFloatingSurface,
} from "@/core/floating-surfaces";
import { launcherCopy } from "./copy";
import { layoutFan, type FanLayout } from "./fan";
import { ItemIcon } from "./icons";
import { InkBot } from "./ink-bot";
import { optionDefaults, type LauncherOptions } from "./options.generated";
import styles from "./launcher.module.css";

type Entry = {
  key: string;
  label: string;
  href: string;
  icon: ReactNode;
  external: boolean;
  current: boolean;
};

/** Below music (10): the player keeps its anchor and the launcher moves aside. */
const PRIORITY = 5;
const ITEM = 48;
const fanSizes = (coarse: boolean) => ({
  item: ITEM,
  spacing: coarse ? 76 : 60,
  radius: coarse ? 104 : 92,
  ringGap: coarse ? 76 : 64,
});

const emptySubscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

function localPath(href: string) {
  return href.startsWith("/") && !href.startsWith("//");
}

function Launcher({ options, context }: PluginProps<LauncherOptions>) {
  const {
    label,
    position,
    size,
    offsetBottom,
    home,
    pages,
    items: links,
  } = { ...optionDefaults, ...options };
  const text = launcherCopy(context.locale);
  const name = label ?? text.label;
  const pathname = usePathname();
  const router = useRouter();
  const menuId = useId();
  const pluginPages = context.pages;
  const locale = context.locale;

  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = [];
    if (home && pathname !== "/")
      list.push({
        key: "home",
        label: launcherCopy(locale).home,
        href: "/",
        icon: <House aria-hidden="true" />,
        external: false,
        current: false,
      });
    if (pages)
      // Pages only: a plugin that opens in place has its own way in.
      for (const page of (pluginPages ?? []).filter(
        (link) => link.kind === "page",
      ))
        list.push({
          key: `${page.kind}:${page.id}`,
          label: page.title,
          href: page.href,
          icon: page.icon ?? <ItemIcon name="link" />,
          external: false,
          current: pathname === page.href,
        });
    links.forEach((item, index) =>
      list.push({
        key: `item:${index}`,
        label: item.label,
        href: item.href,
        icon: <ItemIcon name={item.icon} />,
        external: /^https:/.test(item.href),
        current: localPath(item.href) && pathname === item.href,
      }),
    );
    return list;
  }, [home, pages, links, pluginPages, pathname, locale]);

  // The fan belongs to the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = useCallback(
    (next: boolean) => setOpenOn(next ? pathname : null),
    [pathname],
  );
  // The fan's pages load when it opens, not with every page that shows the
  // launcher: a tool page can bring fonts and code the page itself never
  // needs. Its links therefore never prefetch on sight.
  useEffect(() => {
    if (!open) return;
    for (const entry of entries)
      if (!entry.external && !entry.current && localPath(entry.href))
        router.prefetch(entry.href);
  }, [open, entries, router]);
  const [react, setReact] = useState(0);
  const [fan, setFan] = useState<FanLayout | null>(null);
  const root = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLAnchorElement | null)[]>([]);
  const focusFirst = useRef(false);
  const surface = useFloatingSurface(PRIORITY);
  const attach = useCallback(
    (element: HTMLDivElement | null) => {
      root.current = element;
      return surface(element);
    },
    [surface],
  );

  // Read by the measuring callback, which stays stable for its listeners.
  const count = useRef(0);
  useEffect(() => {
    count.current = entries.length;
  });
  const measure = useCallback(() => {
    const button = trigger.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const viewport = window.visualViewport;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const sizes = fanSizes(coarse);
    setFan(
      layoutFan(count.current, {
        center: {
          x: rect.left + rect.width / 2 - (viewport?.offsetLeft ?? 0),
          y: rect.top + rect.height / 2 - (viewport?.offsetTop ?? 0),
        },
        viewport: {
          width: viewport?.width ?? window.innerWidth,
          height: viewport?.height ?? window.innerHeight,
        },
        ...sizes,
        // A larger drop (the size option) pushes the first ring clear of it.
        radius: Math.max(sizes.radius, rect.width / 2 + ITEM / 2 + 6),
      }),
    );
  }, []);

  const close = useCallback(
    (restoreFocus: boolean) => {
      setOpen(false);
      if (restoreFocus) trigger.current?.focus();
    },
    [setOpen],
  );

  const toggle = (byKeyboard: boolean) => {
    if (open) {
      close(false);
      return;
    }
    measure();
    focusFirst.current = byKeyboard;
    setReact((value) => value + 1);
    setOpen(true);
  };

  // One open panel at a time across plugins; navigation closes the fan.
  useEffect(() => {
    const element = root.current;
    if (!open || !element) return;
    const release = claimFloatingPanel(element, () => setOpen(false));
    const onOutside = (event: PointerEvent) => {
      if (!element.contains(event.target as Node)) setOpen(false);
    };
    const onLayout = () => measure();
    document.addEventListener("pointerdown", onOutside, true);
    element.addEventListener("floatinglayout", onLayout);
    window.addEventListener("resize", onLayout);
    return () => {
      release();
      document.removeEventListener("pointerdown", onOutside, true);
      element.removeEventListener("floatinglayout", onLayout);
      window.removeEventListener("resize", onLayout);
    };
  }, [open, measure, setOpen]);

  useEffect(() => {
    if (open && focusFirst.current) {
      focusFirst.current = false;
      items.current[0]?.focus();
    }
  }, [open]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
      return;
    }
    const anchors = items.current.filter(Boolean) as HTMLAnchorElement[];
    const at = anchors.indexOf(document.activeElement as HTMLAnchorElement);
    const step =
      event.key === "ArrowDown" || event.key === "ArrowRight"
        ? 1
        : event.key === "ArrowUp" || event.key === "ArrowLeft"
          ? -1
          : 0;
    let next = -1;
    if (step) next = at < 0 ? 0 : (at + step + anchors.length) % anchors.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = anchors.length - 1;
    if (next < 0) return;
    event.preventDefault();
    anchors[next]?.focus();
  };

  if (!entries.length) return null;

  const style = {
    "--launcher-size": `${size}px`,
    ...(offsetBottom !== undefined
      ? { "--launcher-bottom": `${offsetBottom}px` }
      : {}),
  } as CSSProperties;

  return (
    <div
      ref={attach}
      data-plugin="launcher"
      data-position={position}
      data-open={open}
      data-horizontal={fan?.horizontal ?? (position === "right" ? -1 : 1)}
      data-vertical={fan?.vertical ?? -1}
      className={styles.launcher}
      style={style}
      onKeyDown={onKeyDown}
    >
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        aria-label={(open ? text.close : text.open).replace("%s", name)}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={(event) => toggle(event.detail === 0)}
      >
        <InkBot react={react} className={styles.bot} />
      </button>
      <ul id={menuId} className={styles.fan} aria-label={name} inert={!open}>
        {entries.map((entry, index) => {
          const point = fan?.points[index] ?? { x: 0, y: 0 };
          const itemStyle = {
            "--x": `${point.x}px`,
            "--y": `${point.y}px`,
            "--i": index,
            "--n": entries.length,
          } as CSSProperties;
          const body = (
            <>
              <span className={styles.disc}>{entry.icon}</span>
              <span className={styles.label}>{entry.label}</span>
            </>
          );
          return (
            <li key={entry.key} className={styles.slot} style={itemStyle}>
              {entry.external ? (
                <a
                  ref={(element) => {
                    items.current[index] = element;
                  }}
                  className={styles.item}
                  href={entry.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${entry.label} (${text.external})`}
                  onClick={() => setOpen(false)}
                >
                  {body}
                </a>
              ) : localPath(entry.href) ? (
                <Link
                  ref={(element) => {
                    items.current[index] = element;
                  }}
                  className={styles.item}
                  href={entry.href}
                  prefetch={false}
                  aria-current={entry.current ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  {body}
                </Link>
              ) : (
                <a
                  ref={(element) => {
                    items.current[index] = element;
                  }}
                  className={styles.item}
                  href={entry.href}
                  onClick={() => setOpen(false)}
                >
                  {body}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function ToolLauncher(props: PluginProps<LauncherOptions>) {
  const ready = useSyncExternalStore(emptySubscribe, clientReady, serverReady);
  // A body portal avoids fixed-position containment and clipping by template
  // transforms; the launcher sits in the same floating column on every page.
  return ready ? createPortal(<Launcher {...props} />, document.body) : null;
}
