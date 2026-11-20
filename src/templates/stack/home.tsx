import type { TemplateModule } from "@/core/contracts";
import { getBlogIndexPosts } from "@/blog";
import { buildStack, type SectionId } from "./data";
import { Landing } from "./parts/landing";
import { ArrowUp } from "./parts/icons";
import { Cover } from "./sections/cover";
import { About } from "./sections/about";
import { Work } from "./sections/work";
import { Writing } from "./sections/writing";
import { Prints } from "./sections/prints";
import { Contact } from "./sections/contact";
import s from "./stack.module.css";

/** One person's pile of paper: the calling card on top, then a divider per section. */
const Home: TemplateModule["Home"] = ({ context }) => {
  const data = buildStack(
    context,
    context.capabilities.writing ? getBlogIndexPosts() : [],
  );
  const slot = (id: SectionId) => data.tabs.findIndex((tab) => tab.id === id);
  return (
    <div className={s.page}>
      <Landing />
      <Cover data={data} />
      <main id="main" className={s.main}>
        {slot("about") >= 0 && <About data={data} slot={slot("about")} />}
        {slot("work") >= 0 && <Work data={data} slot={slot("work")} />}
        {slot("writing") >= 0 && <Writing data={data} slot={slot("writing")} />}
        {slot("photography") >= 0 && (
          <Prints data={data} slot={slot("photography")} />
        )}
        {slot("contact") >= 0 && <Contact data={data} slot={slot("contact")} />}
      </main>
      <footer className={`${s.foot} ${s.label}`}>
        <span>
          © {data.footer.year} {data.footer.name}
        </span>
        <a href="#top">
          {data.labels.backToTop} <ArrowUp width={12} height={12} />
        </a>
      </footer>
    </div>
  );
};
export default Home;
