import type { FeaturedLink as LinkConfig } from "../data";
import { Code2 } from "lucide-react";
import { NorthEastIcon } from "./Icons";

export function FeaturedLink({ link }: { link: LinkConfig | null }) {
  if (!link) return null;
  const populated = Boolean(link.href || link.image || link.icon);
  const content = !populated ? (
    <svg
      className="featured-link-frame"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="44" height="44" rx="9" />
      <path d="M9 24h30M24 9v30" strokeWidth=".5" />
      <circle cx="24" cy="24" r="15" strokeWidth=".5" />
    </svg>
  ) : link.image ? (
    <img
      className="featured-link-logo"
      src={link.image}
      width="38"
      height="38"
      alt=""
    />
  ) : link.icon === "github" ? (
    <Code2
      className="featured-link-logo"
      size={38}
      strokeWidth={1.5}
      aria-hidden="true"
    />
  ) : link.icon === "linkedin" ? (
    <span className="featured-link-monogram" aria-hidden="true">
      in
    </span>
  ) : link.icon === "cv" ? (
    <svg
      className="featured-link-logo"
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M8 3h11l6 6v20H8zM19 3v7h6M12 14h9M12 18h9M12 22h6" />
    </svg>
  ) : (
    <NorthEastIcon className="featured-link-logo" />
  );
  return (
    <div className="featured-link" data-populated={populated}>
      <span>{link.label}</span>
      {link.href ? (
        <a
          className="featured-link-tile"
          href={link.href}
          target={link.download ? undefined : "_blank"}
          download={link.download || undefined}
          rel="noopener noreferrer"
          aria-label={link.label}
          title={link.label}
        >
          {content}
        </a>
      ) : (
        <div className="featured-link-tile" aria-label={link.label}>
          {content}
        </div>
      )}
    </div>
  );
}
