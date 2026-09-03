import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function BackToPortfolio({
  className = "back-link",
}: {
  className?: string;
}) {
  return (
    <Link href="/" className={className}>
      <ArrowLeft size={18} /> Back to Portfolio
    </Link>
  );
}

export function AppStoreBadge({
  href,
  className = "app-store-badge",
}: {
  href: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      style={{ display: "inline-block", transition: "transform .2s" }}
    >
      <img
        src="/assets/app-store-badge.svg"
        alt="Download on the App Store"
        style={{ height: 60, width: "auto" }}
      />
    </a>
  );
}
