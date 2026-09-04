import { requireDemoRoutes } from "@/portfolio/demo-routes";
import { routeMetadata } from "@/config/seo";
import "@/styles/flipfact.css";

export const metadata = routeMetadata.flipfactPrivacy;
export default function Page() {
  requireDemoRoutes();
  return (
    <div className="flipfact-privacy-page">
      <div className="flipfact-privacy-container">
        <header className="flipfact-privacy-header">
          <h1 className="flipfact-privacy-title">
            Privacy Policy (FlipFact / Bulb)
          </h1>
          <p className="flipfact-privacy-date">Last updated: March 30, 2026</p>
        </header>
        <div className="flipfact-privacy-content">
          <section className="flipfact-privacy-section">
            <p>
              FlipFact is designed to work with minimal data. This policy
              explains what we collect, how we use it, and your choices.
            </p>
          </section>
          <section className="flipfact-privacy-section">
            <h2>Information we collect</h2>
            <p>
              <strong>App content you request:</strong> When you generate a fact
              (and optionally a sticker), the app sends a prompt and recent
              context needed to avoid repeats to our AI service provider.
            </p>
            <p>
              <strong>On-device app data:</strong> The app stores things like
              recent facts, topic history, preferences (e.g., sound/haptics),
              and daily limits locally on your device.
            </p>
            <p>
              <strong>Purchases/subscriptions (if you buy Plus):</strong> Purchases are processed by Apple’s App Store. We do not collect
              your payment card details.
            </p>
          </section>
          <section className="flipfact-privacy-section">
            <h2>How we use information</h2>
            <ul>
              <li>To generate facts and (if enabled) stickers.</li>
              <li>
                To prevent repeating recent facts and to enforce daily limits.
              </li>
              <li>To operate subscriptions/unlock features.</li>
            </ul>
          </section>
          <section className="flipfact-privacy-section">
            <h2>Sharing</h2>
            <p>
              <strong>AI processing:</strong> Fact/sticker requests are sent to
              an AI provider to generate results.
            </p>
            <p>
              <strong>Apple:</strong> Subscription and purchase processing
              happens through Apple.
            </p>
            <p>We do not sell your personal information.</p>
          </section>
          <section className="flipfact-privacy-section">
            <h2>Data retention</h2>
            <ul>
              <li>
                On-device history stays on your device unless you delete the
                app.
              </li>
              <li>
                AI provider handling/retention (if any) is governed by their
                policies.
              </li>
            </ul>
          </section>
          <section className="flipfact-privacy-section">
            <h2>Your choices</h2>
            <ul>
              <li>
                You can stop data being sent for AI generation by not using the
                generate features.
              </li>
              <li>
                You can delete local data by uninstalling the app (or using any
                in-app reset/clear options if provided).
              </li>
            </ul>
          </section>
          <section className="flipfact-privacy-section">
            <h2>Children’s privacy</h2>
            <p>
              FlipFact is not intended for children under 13, and we do not
              knowingly collect personal information from children.
            </p>
          </section>
          <section className="flipfact-privacy-section">
            <h2>Changes</h2>
            <p>
              We may update this policy from time to time. Updates will be
              posted in the app or where this policy is displayed.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
