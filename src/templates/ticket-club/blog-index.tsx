import type { TemplateModule } from "@/core/contracts";
import { dateOf, labelsOf } from "./data";
import { PageHead, Tags } from "./blog";
import { Listing } from "./listing";
import s from "./site.module.css";

/** Every article, as the programme sets them. */
const BlogIndex: TemplateModule["BlogIndex"] = ({ posts, context }) => {
  const labels = labelsOf(context);
  const locale = context.site.identity.locale;
  const tags = [...new Set(posts.flatMap((post) => [...post.tags]))].sort(
    (x, y) => x.localeCompare(y, locale),
  );
  return (
    <main id="main" className={s.main}>
      <section className={s.section}>
        <PageHead
          kicker={context.site.identity.name}
          title={context.writing.heading || context.writing.title}
        >
          {context.writing.description}
        </PageHead>
        <Tags labels={tags} all={labels.allPosts} label={labels.tagged} />
        <Listing
          kind="posts"
          level={2}
          rows={posts.map((post) => ({
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
export default BlogIndex;
