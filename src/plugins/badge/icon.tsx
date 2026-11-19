/** A badge on a lanyard, for menus: 24 × 24, drawn in currentColor. */
export default function BadgeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 1.5 11 8M17 1.5 13 8" />
      <rect x="10.5" y="7.5" width="3" height="3" rx="0.8" />
      <rect x="5.5" y="11" width="13" height="11.5" rx="2.2" />
      <circle cx="12" cy="15.5" r="1.8" />
      <path d="M9 20.2c.6-1.3 1.7-2 3-2s2.4.7 3 2" />
    </svg>
  );
}
