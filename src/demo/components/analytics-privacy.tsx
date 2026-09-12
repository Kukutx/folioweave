import { PrivacyPageShell, PrivacySection, privacyClass } from "./privacy-page";

type Props = {
  product: "Habee" | "NotchShelf";
  prefix: "habee" | "notchshelf";
  email: string;
};

const privacyCopy = {
  Habee: {
    subtitle: "Habee App",
    introduction:
      'This Privacy Policy describes how Habee ("we," "our," or "us") collects, uses, and protects information when you use our mobile application (the "App"). We are committed to protecting your privacy and ensuring transparency about our data practices.',
    collectionLead:
      "Habee is designed with privacy in mind. We collect only the minimal information necessary to provide and improve our services:",
    consent:
      "By using the Habee App, you consent to the collection and use of analytics data as described in this Privacy Policy. If you do not agree with this Privacy Policy, please do not use the App.",
  },
  NotchShelf: {
    subtitle: "NotchShelf App",
    introduction:
      'This Privacy Policy describes how NotchShelf ("we," "our," or "us") collects, uses, and protects information when you use our application (the "App"). We are committed to protecting your privacy and ensuring transparency about our data practices.',
    collectionLead:
      "NotchShelf is designed with privacy in mind. We collect only the minimal information necessary to provide and improve our services:",
    consent:
      "By using the NotchShelf App, you consent to the collection and use of analytics data as described in this Privacy Policy. If you do not agree with this Privacy Policy, please do not use the App.",
  },
} as const;

export function AnalyticsPrivacy({ product, prefix, email }: Props) {
  const copy = privacyCopy[product];
  return (
    <PrivacyPageShell prefix={prefix} subtitle={copy.subtitle}>
          <PrivacySection prefix={prefix} title="1. Introduction">
            <p>{copy.introduction}</p>
          </PrivacySection>
          <PrivacySection prefix={prefix} title="2. Information We Collect">
            <p>{copy.collectionLead}</p>
            <h3>2.1 Analytics Data</h3>
            <p>
              We collect anonymous analytics data to understand how users
              interact with the App. This information helps us improve app
              performance, identify bugs, and enhance user experience. The
              analytics data we collect may include:
            </p>
            <ul>
              <li>
                App usage statistics (e.g., features accessed, time spent in the
                App)
              </li>
              <li>Performance metrics (e.g., app crashes, loading times)</li>
              <li>
                Device information (e.g., device type, operating system version)
              </li>
              <li>
                General location data (country/region level, not precise
                location)
              </li>
            </ul>
            <p>
              This analytics data is collected anonymously and cannot be used to
              identify you personally.
            </p>
          </PrivacySection>
          <PrivacySection prefix={prefix} title="3. What We Do Not Collect">
            <p>
              To protect your privacy, we do <strong>not</strong> collect:
            </p>
            <ul>
              <li>
                Personal identification information (name, email address, phone
                number)
              </li>
              <li>Precise location data or GPS coordinates</li>
              <li>Contact lists or address book information</li>
              <li>Photos, videos, or other media files</li>
              <li>Payment or financial information</li>
              <li>Biometric data</li>
              <li>Any content you create or store within the App</li>
            </ul>
          </PrivacySection>
          <PrivacySection prefix={prefix} title="4. How We Use Analytics Data">
            <p>
              We use the analytics data we collect solely for the following
              purposes:
            </p>
            <ul>
              <li>To improve app functionality and user experience</li>
              <li>To identify and fix technical issues and bugs</li>
              <li>To understand user preferences and app usage patterns</li>
              <li>To optimize app performance and stability</li>
              <li>
                To make informed decisions about future app updates and features
              </li>
            </ul>
            <p>
              We do not use analytics data for advertising purposes, and we do
              not sell, rent, or share this data with third parties for their
              marketing purposes.
            </p>
          </PrivacySection>
          <PrivacySection prefix={prefix} title="5. Third-Party Services">
            <p>
              We may use third-party analytics services to help us collect and
              analyze usage data. These services are bound by their own privacy
              policies and are used only for the purposes described in this
              Privacy Policy. These services may include:
            </p>
            <ul>
              <li>
                Analytics platforms that help us understand app usage patterns
              </li>
              <li>
                Crash reporting services that help us identify and fix bugs
              </li>
            </ul>
            <p>
              All third-party services we use are required to maintain
              appropriate security measures and are prohibited from using your
              data for any purpose other than providing services to us.
            </p>
          </PrivacySection>
          <PrivacySection prefix={prefix} title="6. Data Security">
            <p>
              We implement appropriate technical and organizational measures to
              protect the analytics data we collect. However, no method of
              transmission over the internet or electronic storage is 100%
              secure. While we strive to use commercially acceptable means to
              protect your data, we cannot guarantee absolute security.
            </p>
          </PrivacySection>
          <PrivacySection prefix={prefix} title="7. Data Retention">
            <p>
              We retain analytics data only for as long as necessary to fulfill
              the purposes outlined in this Privacy Policy, unless a longer
              retention period is required or permitted by law. When data is no
              longer needed, we delete it in a secure manner.
            </p>
          </PrivacySection>
          <PrivacySection prefix={prefix} title="8. Your Rights">
            <p>
              Depending on your jurisdiction, you may have certain rights
              regarding your data, including:
            </p>
            <ul>
              <li>
                The right to access information about what data we collect
              </li>
              <li>
                The right to request deletion of your data (where applicable)
              </li>
              <li>The right to opt-out of certain data collection practices</li>
            </ul>
            <p>
              If you have questions or wish to exercise any of these rights,
              please contact us using the information provided in the
              &quot;Contact Us&quot; section below.
            </p>
          </PrivacySection>
          <PrivacySection prefix={prefix} title="9. Children's Privacy">
            <p>
              Our App is not intended for children under the age of 13. We do
              not knowingly collect personal information from children under 13.
              If you are a parent or guardian and believe your child has
              provided us with information, please contact us, and we will
              delete such information from our systems.
            </p>
          </PrivacySection>
          <PrivacySection prefix={prefix} title="10. Changes to This Privacy Policy">
            <p>
              We may update this Privacy Policy from time to time to reflect
              changes in our practices or for other operational, legal, or
              regulatory reasons. We will notify you of any material changes by
              updating the &quot;Last Updated&quot; date at the top of this
              Privacy Policy. Your continued use of the App after such changes
              constitutes your acceptance of the updated Privacy Policy.
            </p>
          </PrivacySection>
          <PrivacySection prefix={prefix} title="11. Consent">
            <p>{copy.consent}</p>
          </PrivacySection>
          <PrivacySection prefix={prefix} title="12. Contact Us">
            <p>
              If you have any questions, concerns, or requests regarding this
              Privacy Policy or our data practices, please contact us at:
            </p>
            <p>
              <strong>Email:</strong>{" "}
              <a href={`mailto:${email}`} className={privacyClass(prefix, "link")}>
                {email}
              </a>
            </p>
            <p>
              We will respond to your inquiry as soon as reasonably possible.
            </p>
          </PrivacySection>
          <PrivacySection prefix={prefix} title="13. Governing Law">
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
