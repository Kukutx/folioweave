import Image from "next/image";
import type { TemplateContext } from "@/core/contracts";
import { createRefractData } from "./data";
import { RefractProvider } from "./data-context";
import { PortfolioExperience } from "./components/PortfolioExperience";
import { NorthEastIcon } from "./components/Icons";
import { Reveal } from "./components/Reveal";
import { BackToHome } from "./components/BackToHome";
import type { StylePreset } from "./lib/scene-theme";

export function RefractHome({
  context,
  style,
}: {
  context: TemplateContext;
  style: StylePreset;
}) {
  const data = createRefractData(context);
  const { copy, profile, news, publications, experience, links, socialLinks } =
    data;
  return (
    <RefractProvider data={data}>
      <a className="skip-link" href="#overview">
        {copy.skipToContent}
      </a>
      <main className="refract-home">
        <PortfolioExperience stylePreset={style} />
        <div className="profile-content">
          {data.aboutEnabled && (
            <section
              className="about-section page-width content-section"
              id="about"
              aria-labelledby="about-title"
            >
              <h2 id="about-title" data-refract-reveal>
                {copy.about}
              </h2>
              <div
                className="about-layout"
                data-refract-reveal
                data-portrait={Boolean(profile.portrait)}
              >
                {profile.portrait && (
                  <figure>
                    <Image
                      src={profile.portrait}
                      alt={profile.portraitAlt}
                      width={480}
                      height={480}
                      sizes="(max-width: 899px) 60vw, 22vw"
                    />
                    <figcaption>{profile.name}</figcaption>
                  </figure>
                )}
                <div>
                  {profile.bio.map((text, index) => (
                    <p key={index}>{text}</p>
                  ))}
                  <dl>
                    <div>
                      <dt>{copy.position}</dt>
                      <dd>
                        {[profile.role, profile.affiliation]
                          .filter(Boolean)
                          .join(", ")}
                      </dd>
                    </div>
                    {profile.group && (
                      <div>
                        <dt>{copy.group}</dt>
                        <dd>{profile.group}</dd>
                      </div>
                    )}
                    {profile.focus.length > 0 && (
                      <div>
                        <dt>{copy.focus}</dt>
                        <dd>{profile.focus.join(", ")}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              </div>
            </section>
          )}
          {news.length > 0 && (
            <section
              className="news-section page-width content-section"
              id="news"
              aria-labelledby="news-title"
            >
              <h2 id="news-title" data-refract-reveal>
                {copy.news}
              </h2>
              <div className="news-list">
                {news.map((item) => (
                  <article key={item.id} data-refract-reveal>
                    <time>{item.date}</time>
                    <p>
                      {item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {item.description}
                          <NorthEastIcon />
                        </a>
                      ) : (
                        item.description
                      )}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          )}
          {(experience.length > 0 || publications.length > 0) && (
            <section
              className="cv-section page-width content-section"
              id="cv"
              aria-labelledby="cv-title"
            >
              <h2 id="cv-title" data-refract-reveal>
                {copy.cv}
              </h2>
              <div className="experience-list">
                {experience.map((item) => (
                  <article key={item.id} data-refract-reveal>
                    <span>{item.period}</span>
                    <div>
                      <h3>{item.role}</h3>
                      {item.description && <p>{item.description}</p>}
                    </div>
                  </article>
                ))}
              </div>
              {publications.length > 0 && (
                <>
                  <h3
                    className="publications-heading"
                    id="publications"
                    data-refract-reveal
                  >
                    {copy.publications}
                  </h3>
                  <ol className="publication-list">
                    {publications.map((paper) => (
                      <li key={paper.id} data-refract-reveal>
                        <div>
                          <span>{paper.year}</span>
                          <h4>
                            {paper.url ? (
                              <a
                                href={paper.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {paper.title}
                                <NorthEastIcon />
                              </a>
                            ) : (
                              paper.title
                            )}
                          </h4>
                          <p>
                            {paper.authors} <em>{paper.journal}</em>
                            {paper.citation ? `, ${paper.citation}.` : ""}
                          </p>
                          {paper.highlight && (
                            <p className="paper-highlight">{paper.highlight}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </section>
          )}
          <section
            className="contact-section page-width content-section"
            id="contact"
            aria-labelledby="contact-title"
          >
            <h2 id="contact-title" data-refract-reveal>
              {copy.contact}
            </h2>
            <a className="contact-email" href={links.email}>
              {profile.email}
              <NorthEastIcon />
            </a>
            <div className="contact-links">
              {socialLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {link.label}
                  <NorthEastIcon />
                </a>
              ))}
            </div>
            <footer>
              <span>{profile.name}</span>
              <span>{profile.location}</span>
            </footer>
          </section>
        </div>
      </main>
      <BackToHome label={copy.backToHome} home={copy.home} />
      <Reveal />
    </RefractProvider>
  );
}
