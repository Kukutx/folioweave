import type { TemplateModule } from "@/core/contracts";
import { dateOf, labelsOf } from "./data";
import { PageHead, Tags } from "./blog";
import { Listing } from "./listing";
import s from "./site.module.css";

/** The articles on one topic. */
const BlogTag: TemplateModule["BlogTag"] = ({ tag, context }) => {
  const labels = labelsOf(context);
  const locale = context.site.identity.locale;
  return (
    <main id="main" className={s.main}>
      <section className={s.section}>
        <PageHead
          kicker={`${labels.tagged} · ${tag.posts.length}`}
          title={tag.label}
        />
        <Tags
          labels={tag.labels}
          active={tag.label}
          all={labels.allPosts}
          label={labels.tagged}
        />
        <Listing
          kind="posts"
          level={2}
          rows={tag.posts.map((post) => ({
            key: post.slug,
            num: post.displayDate ?? dateOf(post.date, locale),
            dateTime: post.date.slice(0, 10),
            title: post.title,
            href: post.href,
            text: post.subtitle ?? post.description,
            meta: `${post.readingMinutes} ${labels.minutes}`,
          }))}
        />
      </section>
    </main>
  );
};
export default BlogTag;
