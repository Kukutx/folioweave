import { HomeExperience } from "./home/home-experience";
import { Hero } from "./home/hero-section";
import { InterludeSection } from "./home/interlude-section";
import { Photography } from "./home/photography-section";
import { WorkSection } from "./home/work-section";
import { ContactFooter } from "./home/contact-footer";
import { siteConfig } from "@/config/site";
import styles from "./home/home-experience.module.css";
import { ThemeScope } from "./home/theme-scope";

/** Server composition owns content; the client shell owns only interaction. */
export function HomePage() {
  return (
    <HomeExperience>
      <main id="main-content" className={styles.main} tabIndex={-1}>
        <ThemeScope>
          <Hero />
        </ThemeScope>
        <ThemeScope>
          <InterludeSection />
        </ThemeScope>
        {siteConfig.features.work && (
          <ThemeScope>
            <WorkSection />
          </ThemeScope>
        )}
        {siteConfig.features.photography && (
          <ThemeScope>
            <Photography />
          </ThemeScope>
        )}
        <ThemeScope>
          <div className="container">
            <ContactFooter />
          </div>
        </ThemeScope>
      </main>
    </HomeExperience>
  );
}
