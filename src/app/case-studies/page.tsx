import { requireDemoRoutes } from "@/portfolio/demo-routes";
import { routeMetadata } from "@/config/seo";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import "@/styles/case-studies.css";

export const metadata = routeMetadata.caseStudies;

export default function CaseStudiesPage() {
  requireDemoRoutes();
  return (
    <div className="case-studies-page">
      <div className="case-studies-container">
        <Link href="/" className="case-studies-back-link">
          <ArrowLeft size={18} />
          <span>Back to Portfolio</span>
        </Link>
        <header className="case-studies-header">
          <h1 className="case-studies-title">Case Studies</h1>
          <p className="case-studies-intro">
            Here are a few of many projects I worked on.
          </p>
        </header>
        <div className="case-studies-grid">
          <Link
            href="/district"
            target="_blank"
            rel="noopener noreferrer"
            className="case-study-card"
            style={{
              cursor: "pointer",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div className="case-study-card-image">
              <img
                src="/media/5c0589_3bacee1390ea4982b60a15ffa787763d~mv2.webp"
                alt="District By Zomato"
              />
            </div>
            <div className="case-study-card-content">
              <h2 className="case-study-card-title">District By Zomato</h2>
              <p className="case-study-card-description">
                Designing for the Movies vertical, facilitating over 75 million
                ticket sales with scalable, user-friendly flows
              </p>
              <span className="case-study-card-link">Read Case Study →</span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
