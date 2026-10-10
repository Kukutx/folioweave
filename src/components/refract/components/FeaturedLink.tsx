import type { FeaturedLink as LinkConfig } from "../data";

// The GitHub mark, from Simple Icons (CC0).
const githubMark =
  "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12";

/** The author's own mark for the tile, or null where none was chosen. */
export function FeaturedLinkMark({ link }: { link: LinkConfig }) {
  if (link.image)
    return (
      <img
        className="featured-link-logo"
        src={link.image}
        width="38"
        height="38"
        alt=""
      />
    );
  if (link.icon === "github")
    return (
      <svg
        className="featured-link-logo"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d={githubMark} />
      </svg>
    );
  if (link.icon === "linkedin")
    return (
      <span className="featured-link-monogram" aria-hidden="true">
        in
      </span>
    );
  if (link.icon === "cv")
    return (
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
    );
  if (link.icon === "sponsor")
    return (
      <svg
        className="featured-link-logo"
        viewBox="0 0 32 32"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M16 27S5 20.5 5 12.5A6 6 0 0 1 16 9.2a6 6 0 0 1 11 3.3C27 20.5 16 27 16 27Z" />
      </svg>
    );
  return null;
}

/** Where the link leads: a download stays in the page, the rest opens beside it. */
export const featuredLinkTarget = (link: LinkConfig) =>
  link.download
    ? { download: true }
    : { target: "_blank", rel: "noopener noreferrer" };

/** The tile beside the hero. It starts as a construction drawing that stands
 * for nothing in particular; the author's mark replaces it, and a link makes it
 * lead somewhere. With no tile configured there is nothing here at all. */
export function FeaturedLink({ link }: { link: LinkConfig | null }) {
  if (!link) return null;
  const mark = <FeaturedLinkMark link={link} />;
  const populated = Boolean(link.image || link.icon);
  const content = populated ? (
    mark
  ) : (
    // The keyline grid an icon is drawn on: frame, inset, three circles,
    // centre lines and diagonals.
    <svg
      className="featured-link-frame"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <rect
        x=".6"
        y=".6"
        width="46.8"
        height="46.8"
        rx="8.4"
        strokeWidth="1.2"
      />
      <g strokeWidth=".3">
        <rect x="3.9" y="3.9" width="40.2" height="40.2" rx="5" />
        <circle cx="24" cy="24" r="20.1" />
        <circle cx="24" cy="24" r="13.3" />
        <circle cx="24" cy="24" r="9.5" />
        <path d="M24 3.9v40.2M3.9 24h40.2M5.4 5.4l37.2 37.2M42.6 5.4 5.4 42.6" />
      </g>
    </svg>
  );
  return (
    <div className="featured-link" data-populated={populated}>
      <span>{link.label}</span>
      {link.href ? (
        <a
          className="featured-link-tile"
          href={link.href}
          {...featuredLinkTarget(link)}
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
