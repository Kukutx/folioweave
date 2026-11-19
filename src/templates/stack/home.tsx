import Link from "next/link";
import type { TemplateModule } from "@/core/contracts";
import { getBlogIndexPosts } from "@/blog";
import { buildStack, type StackData } from "./data";
import { Chat } from "./chat";
import { Hero } from "./hero";
import * as I from "./icons";
import { Art, NavLinks, NoScriptHolds, Prints, Shuffle, WallClock } from "./islands";
import { PreviewLink, PreviewProvider } from "./preview";
import { Work } from "./work";
import s from "./stack.module.css";

function Bio({ d }: { d: StackData }) {
  if (!d.bio.length) return null;
  return (
    <p className={s.bio}>
      {d.bio.map((part, i) => {
        if ("text" in part) return <span key={i}>{part.text}</span>;
        const inner = (
          <>
            {part.brand.name}
            <img className={s.inlineLogo} src={part.brand.icon} alt="" width={16} height={16} />
          </>
        );
        return part.brand.href ? (
          <PreviewLink key={i} className={s.strong} href={part.brand.href} preview={part.brand.preview}>
            {inner}
          </PreviewLink>
        ) : (
          <span key={i} className={s.strong}>
            {inner}
          </span>
        );
      })}
    </p>
  );
}

function Experience({ d, id }: { d: StackData; id?: string }) {
  if (!d.experience.length && !d.story.length) return null;
  return (
    <section id={id} className={s.section}>
      <h2 className={s.label}>{d.labels.experience}</h2>
      {d.story.map((paragraph, pi) => (
        <p key={pi} className={`${s.text} ${s.story}`}>
          {paragraph.map((part, i) => (
            <span key={i} data-tone={part.tone}>
              {part.text}
            </span>
          ))}
        </p>
      ))}
      {d.experience.length > 0 && (
        <ul className={s.exp}>
          {d.experience.map((x, i) => (
            <li key={i} className={s.expRow}>
              <span className={s.when}>{x.when}</span>
              <span className={s.expBody}>
                <span className={s.expTitle}>{x.title}</span>
                <span className={s.text}>{x.text}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Tools({ d }: { d: StackData }) {
  if (!d.tools.length) return null;
  return (
    <section className={`${s.section} ${s.stackSection}`}>
      <h2 className={s.label}>{d.labels.stack}</h2>
      <ul className={s.tools} data-few={d.tools.length < 8}>
        {d.tools.map((t) => (
          <li key={t.name} tabIndex={0} aria-label={t.name}>
            <img src={t.icon} alt="" className={s.toolLogo} width={38} height={38} />
            <span className={s.tip} aria-hidden="true">
              {t.name}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Ventures({ d, id }: { d: StackData; id?: string }) {
  if (!d.ventures.length) return null;
  return (
    <section id={id} className={`${s.section} ${s.venturesSection}`}>
      <h2 className={s.label}>{d.labels.ventures}</h2>
      <ul className={s.ventures}>
        {d.ventures.map((v) => {
          const inner = (
            <>
              {v.icon ? (
                <img className={s.ventureLogo} src={v.icon} alt="" width={38} height={38} />
              ) : (
                <span className={`${s.ventureLogo} ${s.initial}`} aria-hidden="true">
                  {Array.from(v.name)[0]}
                </span>
              )}
              <span className={s.ventureText}>
                <b>{v.name}</b>
                <small>{v.sub}</small>
              </span>
              {v.href && <I.ArrowUpRight className={s.arrow} />}
            </>
          );
          return (
            <li key={v.id}>
              {v.href ? (
                <PreviewLink className={s.band} href={v.href} newTab={v.newTab} preview={v.preview}>
                  {inner}
                </PreviewLink>
              ) : (
                <div className={s.band}>{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Writing({ d }: { d: StackData }) {
  if (!d.writing.length) return null;
  return (
    <section id="thoughts" className={`${s.section} ${s.writingSection}`}>
      <h2 className={s.label}>{d.labels.writing}</h2>
      <ul className={s.writing}>
        {d.writing.map((p) => (
          <li key={p.id}>
            <Link className={`${s.band} ${s.post}`} href={p.href}>
              <span className={s.when}>{p.date}</span>
              <span className={s.postTitle}>{p.title}</span>
              <span className={s.mins}>
                <I.Clock />
                {p.mins}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Personal({ d }: { d: StackData }) {
  const p = d.personal;
  if (!p && !d.art) return null;
  return (
    <section id={p ? "photography" : undefined} className={`${s.section} ${s.personalSection}`}>
      {p && (
        <>
          <h2 className={s.label}>{d.labels.personal}</h2>
          {p.text && <p className={s.text}>{p.text}</p>}
          <Prints photos={p.photos} />
          {(p.camera || p.more) && (
            <div className={s.photoFoot}>
              <span>{p.camera && `${d.labels.shotWith} ${p.camera}`}</span>
              {p.more && (
                <a href={p.more.href} target="_blank" rel="noreferrer">
                  {p.more.label}
                  <I.Instagram />
                </a>
              )}
            </div>
          )}
        </>
      )}
      {d.art && <Art pocketLabel={d.pocketLabel} />}
    </section>
  );
}

const Home: TemplateModule["Home"] = ({ context }) => {
  const d = buildStack(context, context.capabilities.writing ? getBlogIndexPosts() : []);
  const hasWork = d.words.length > 0;
  const workAt = d.experience.length ? "experience" : hasWork ? "stuff" : "ventures";
  return (
    <PreviewProvider>
      <NoScriptHolds />
      <div className={s.wrap}>
        <nav className={s.nav}>
          <span>{d.est}</span>
          <NavLinks nav={d.nav} />
        </nav>

        <Hero
          name={d.name}
          role={d.role}
          avatar={d.avatar}
          photos={d.photos}
          showLabel={d.labels.showPhotos}
          hideLabel={d.labels.hidePhotos}
        />
        <Bio d={d} />

        <Experience d={d} id={workAt === "experience" ? "work" : undefined} />
        {hasWork && (
          <Work
            id={workAt === "stuff" ? "work" : undefined}
            label={d.labels.stuff}
            words={d.words}
            cards={d.fan}
            workLabel={d.labels.selectedWork}
          />
        )}
        {d.shuffle.length > 0 && <Shuffle cards={d.shuffle} />}
        <Tools d={d} />
        <Ventures d={d} id={workAt === "ventures" ? "work" : undefined} />
        <Writing d={d} />
        <Personal d={d} />
        {d.chat.length > 0 && <Chat chat={d.chat} email={d.email} labels={d.labels} />}

        {d.ending && (
          <>
            <p className={s.note}>{d.ending.note}</p>
            <p className={s.quote}>
              {`"${d.ending.quote}"`}
              {d.ending.author && <span className={s.quoteBy}> — {d.ending.author}</span>}
            </p>
          </>
        )}

        <footer className={s.foot}>
          <span>
            {d.footer.avatar && <img src={d.footer.avatar} alt="" width={24} height={24} />}
            {d.footer.name}
          </span>
          <span>
            <I.Clock />
            <WallClock timeZone={d.footer.timeZone} locale={d.locale} />
          </span>
        </footer>
      </div>
    </PreviewProvider>
  );
};
export default Home;
