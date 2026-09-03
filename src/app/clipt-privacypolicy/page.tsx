import { products } from "@/config/products";
import { routeMetadata } from "@/config/seo";
import { PrivacyPageShell, PrivacySection, privacyClass } from "@/components/privacy-page";
import "@/styles/privacy.css";

export const metadata = routeMetadata.cliptPrivacy;
export default function Page() {
  return (
    <PrivacyPageShell prefix="clipt" subtitle="Clipt App">
          <PrivacySection prefix="clipt" title="1. Introduction">
            <p>
              This Privacy Policy describes how Clipt (&quot;we,&quot;
              &quot;our,&quot; or &quot;us&quot;) handles information when you
              use our application (the &quot;App&quot;). We are committed to
              protecting your privacy and ensuring transparency about our data
              practices.
            </p>
          </PrivacySection>
          <PrivacySection prefix="clipt" title="2. Information Collection and Storage">
            <p>Clipt is designed with privacy as a fundamental principle.</p>
            <p>
              <strong>None of the things copied are stored by us.</strong>
            </p>
            <p>
              The content you copy or manage using Clipt remains on your device.
              We do not transmit, store, or have access to your clipboard
              history or any other content you copy.
            </p>
          </PrivacySection>
          <PrivacySection prefix="clipt" title="3. What We Do Not Collect">
            <p>
              To protect your privacy, we do <strong>not</strong> collect:
            </p>
            <ul>
              <li>Content of your clipboard</li>
              <li>
                Personal identification information (name, email address, phone
                number)
              </li>
              <li>Precise location data</li>
              <li>Photos, videos, or other media files</li>
            </ul>
          </PrivacySection>
          <PrivacySection prefix="clipt" title="4. Contact Us">
            <p>
              If you have any questions, concerns, or requests regarding this
              Privacy Policy, please contact us at:
            </p>
            <p>
              <strong>Email:</strong>{" "}
              <a
                href={`mailto:${products.clipt.supportEmail}`}
                className={privacyClass("clipt", "link")}
              >
                {products.clipt.supportEmail}
              </a>
            </p>
            <p>
              We will respond to your inquiry as soon as reasonably possible.
            </p>
          </PrivacySection>
          <PrivacySection prefix="clipt" title="5. Governing Law">
            <p>
              This Privacy Policy is governed by and construed in accordance
              with the laws of India. Any disputes arising from or relating to
              this Privacy Policy shall be subject to the exclusive jurisdiction
              of the courts of India.
            </p>
          </PrivacySection>
    </PrivacyPageShell>
  );
}
