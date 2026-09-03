import { routeMetadata } from "@/config/seo";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ReferenceCalendarIcon, ReferenceClockIcon } from "@/components/reference-icons";
import "@/styles/blogs.css";
import { siteCopyright } from "@/config/site";

export const metadata = routeMetadata.blogs;
export default function BlogsPage() {
  return (
    <div className="writing-container">
      <header className="writing-header">
        <div>
          <h1 className="writing-title">OG Blogs</h1>
          <p className="writing-subtitle">
            Thoughts on{" "}
            <span className="highlight-yellow">design engineering</span>,{" "}
            <span className="highlight-yellow">product philosophy</span>, and
            the <span className="highlight-yellow">obsession with detail</span>.
          </p>
        </div>
      </header>
      <main className="writing-list-container">
        <div className="blogs-grid">
          <div>
            <Link
              href="/blogs/clipt"
              className="blog-card"
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="blog-card-image">
                <img
                  src="/media/5c0589_42a00ff8590c4ff5b1cf8496183b08b8~mv2.webp"
                  alt="Clipt: How I built a clipboard history app and keyboard for iOS."
                />
              </div>
              <div className="blog-card-content">
                <div className="blog-meta">
                  <span className="blog-date">
                    <ReferenceCalendarIcon size={14} /> Jan 26, 2026
                  </span>
                  <span className="blog-separator">•</span>
                  <span className="blog-read-time">
                    <ReferenceClockIcon size={14} /> 6 min read
                  </span>
                </div>
                <h2 className="blog-card-title">
                  Clipt: How I built a clipboard history app and keyboard for
                  iOS.
                  <span
                    style={{
                      display: "block",
                      fontSize: "1rem",
                      color: "#424245",
                      marginTop: ".4rem",
                      fontWeight: 400,
                    }}
                  >
                    (It&apos;s complex than you think)
                  </span>
                </h2>
                <div className="blog-tags">
                  {["Engineering", "iOS", "ELI5", "For Designers"].map(
                    (tag) => (
                      <span className="blog-tag" key={tag}>
                        {tag}
                      </span>
                    ),
                  )}
                </div>
                <p className="blog-card-excerpt">
                  How I built a clipboard manager that feels like a native part
                  of iOS, from SwiftUI to SwiftData and the challenges of IPC.
                </p>
                <span className="read-more">
                  Read post <ArrowRight size={16} />
                </span>
              </div>
            </Link>
          </div>
        </div>
      </main>
      <footer className="writing-footer">
        <p>{siteCopyright}</p>
      </footer>
    </div>
  );
}
