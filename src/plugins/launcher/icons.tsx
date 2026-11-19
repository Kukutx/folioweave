import {
  Code,
  House,
  Image as Picture,
  Link as Chain,
  Mail,
  Music,
  Newspaper,
  Star,
  User,
} from "lucide-react";
import type { LauncherItem } from "./options.generated";

const icons = {
  link: Chain,
  home: House,
  article: Newspaper,
  image: Picture,
  mail: Mail,
  user: User,
  code: Code,
  music: Music,
  star: Star,
} satisfies Record<NonNullable<LauncherItem["icon"]>, unknown>;

export function ItemIcon({ name }: { name: LauncherItem["icon"] }) {
  const Icon = icons[name ?? "link"];
  return <Icon aria-hidden="true" />;
}
