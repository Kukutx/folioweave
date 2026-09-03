import { products } from "@/config/products";
import { routeMetadata } from "@/config/seo";
import Link from "next/link";
import "@/styles/brink-privacy.css";

export const metadata = routeMetadata.brinkPrivacy;
export default function Page() {
  return (
    <div className="brink-ppPage">
      <main className="brink-ppShell">
        <header className="brink-ppHeader">
          <Link className="brink-ppBack" href="/brink">
            ← Back
          </Link>
          <div className="brink-ppBrand">
            <img className="brink-ppLogo" src="/brink/logo.png" alt="" />
            <div className="brink-ppName">Brink</div>
          </div>
        </header>
        <h1 className="brink-ppTitle">Privacy Policy</h1>
        <p className="brink-ppMeta">Last updated: March 13, 2026</p>
        <section className="brink-ppSection">
          <h2>Overview</h2>
          <p>
            Brink is a podcast player. This Privacy Policy explains how
            information is handled when you use the app and related services.
          </p>
        </section>
        <section className="brink-ppSection">
          <h2>Information We Collect</h2>
          <ul>
            <li>
              <strong>Information you provide:</strong> Any information you
              choose to share with us (for example, via support requests).
            </li>
            <li>
              <strong>App usage data:</strong> Basic diagnostics such as crash
              logs and performance data (if enabled by your device settings).
            </li>
            <li>
              <strong>Device information:</strong> Non-identifying technical
              details like device model, OS version, and app version.
            </li>
          </ul>
        </section>
        <section className="brink-ppSection">
          <h2>How We Use Information</h2>
          <ul>
            <li>Provide and improve Brink’s features and performance.</li>
            <li>
              Fix bugs, troubleshoot issues, and respond to support requests.
            </li>
            <li>Maintain app security and prevent misuse.</li>
          </ul>
        </section>
        <section className="brink-ppSection">
          <h2>Data Sharing</h2>
          <p>
            We do not sell your personal information. We may share limited
            information with service providers that help us operate the app (for
            example, analytics or crash reporting), only as needed to provide
            the service.
          </p>
        </section>
        <section className="brink-ppSection">
          <h2>Third-Party Content</h2>
          <p>
            Brink plays podcasts from third-party publishers. When you interact
            with third-party links or content, their privacy practices apply.
          </p>
        </section>
        <section className="brink-ppSection">
          <h2>Data Retention</h2>
          <p>
            We retain information only for as long as necessary to provide
            Brink, comply with legal obligations, resolve disputes, and enforce
            agreements.
          </p>
        </section>
        <section className="brink-ppSection">
          <h2>Your Choices</h2>
          <ul>
            <li>
              You can control certain diagnostics/analytics sharing from your
              device and OS settings.
            </li>
            <li>
              You can delete the app at any time to remove locally stored app
              data on your device.
            </li>
          </ul>
        </section>
        <section className="brink-ppSection">
          <h2>Security</h2>
          <p>
            We take reasonable measures to protect information. However, no
            method of transmission or storage is 100% secure.
          </p>
        </section>
        <section className="brink-ppSection">
          <h2>Contact</h2>
          <p>
            If you have questions about this Privacy Policy, contact:{" "}
            <a href={`mailto:${products.brink.supportEmail}`}>{products.brink.supportEmail}</a>
          </p>
        </section>
        <footer className="brink-ppFooter">
          <Link href="/brink">Brink</Link>
          <span>·</span>
          <Link href="/brink/privacy">Privacy</Link>
        </footer>
      </main>
    </div>
  );
}
