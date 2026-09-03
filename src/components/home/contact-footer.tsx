import { type CSSProperties, type RefObject } from "react";
import { homeContent } from "@/content/home";
import { siteConfig } from "@/config/site";
import {
  ReferenceEnvelopeIcon,
  ReferenceInstagramIcon,
  ReferenceLinkedInIcon,
  ReferenceTwitterIcon,
} from "../reference-icons";

const iconMap = {
  Twitter: ReferenceTwitterIcon,
  LinkedIn: ReferenceLinkedInIcon,
  Instagram: ReferenceInstagramIcon,
  Email: ReferenceEnvelopeIcon,
} as const;
export function ContactFooter({
  sectionRef,
}: {
  sectionRef: RefObject<HTMLElement | null>;
}) {
  return (
    <section
      ref={sectionRef}
      className="contact-section"
      id="contact"
      style={{
        paddingTop: "8rem",
        paddingBottom: "5rem",
        textAlign: "center",
        background: "transparent",
      }}
    >
      <div className="container">
        <div className="footer-book-scene" aria-hidden>
          <div className="footer-book-wrap">
            <div className="footer-book-left-side">
              <div className="footer-book-cover-left" />
              <div className="footer-book-layer footer-book-layer1">
                <div className="footer-book-page-left" />
              </div>
              <div className="footer-book-layer footer-book-layer2">
                <div className="footer-book-page-left" />
              </div>
              <div className="footer-book-layer footer-book-layer3">
                <div className="footer-book-page-left" />
              </div>
              <div className="footer-book-layer footer-book-layer4">
                <div className="footer-book-page-left" />
              </div>
              <div className="footer-book-layer-text">
                <div className="footer-book-page-left-2">
                  <div className="footer-book-corner" />
                  <div className="footer-book-corner2" />
                  <div className="footer-book-corner-fold" />
                  <div className="footer-book-page-text footer-book-page-text--left-title">
                    <h3 className="footer-book-left-title">{homeContent.footerBook.title}</h3>
                  </div>
                </div>
              </div>
            </div>
            <div className="footer-book-center" />
            <div className="footer-book-right-side">
              <div className="footer-book-cover-right" />
              <div className="footer-book-layer footer-book-layer1">
                <div className="footer-book-page-right" />
              </div>
              <div className="footer-book-layer footer-book-layer2 footer-book-layer-right">
                <div className="footer-book-page-right" />
              </div>
              <div className="footer-book-layer footer-book-layer3 footer-book-layer-right">
                <div className="footer-book-page-right" />
              </div>
              <div className="footer-book-layer footer-book-layer4 footer-book-layer-right">
                <div className="footer-book-page-right" />
              </div>
              <div className="footer-book-layer-text footer-book-layer-text-right">
                <div className="footer-book-page-right-2">
                  <div className="footer-book-page-text footer-book-page-text--center">
                    <p>{`"${homeContent.footerBook.quote}"`}</p>
                    <h6>{`- ${homeContent.footerBook.author}`}</h6>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="contact-social-links">
          {siteConfig.socialLinks.map(({ label, href, brand }) => {
            const Icon = iconMap[label];
            const external = href.startsWith("http");
            return (
              <a
                key={label}
                href={href}
                aria-label={label}
                className="contact-social-link"
                style={{ "--brand": brand } as CSSProperties}
                {...(external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                <span className="contact-social-icon">
                  <Icon size={19} aria-hidden />
                </span>
                <span className="contact-social-label">{label}</span>
              </a>
            );
          })}
        </div>
        <div className="footer-presence-row">
          <div
            className="presence-widget"
            style={{
              fontSize: "0.75rem",
              opacity: 0.8,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              className="location-pill"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(0,0,0,.05)",
                padding: "4px 10px",
                borderRadius: 20,
                border: "1px solid rgba(0,0,0,.05)",
                whiteSpace: "nowrap",
              }}
            >
              <span>{siteConfig.location.country}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
