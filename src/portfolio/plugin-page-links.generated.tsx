// Generated plugin page and action links for menus; no implementation is imported.
import 'server-only';
import type { PluginPageLink } from '@/core/contracts';
import Icon0 from "@/plugins/emojicut/icon";
import Icon1 from "@/plugins/badge/icon";
export const pluginPageLinks: PluginPageLink[] = [
  { id: "emojicut", path: "emojicut", href: "/tools/emojicut", title: "EmojiCut", description: "Turn a sticker sheet into separate transparent stickers, or design one from a character with AI.", kind: "page", icon: <Icon0 /> },
  { id: "badge", path: "badge", href: "#badge", title: "Badge", description: "Open the work badge.", kind: "action", icon: <Icon1 /> },
];
