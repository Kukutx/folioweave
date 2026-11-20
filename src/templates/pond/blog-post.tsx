import Link from "next/link";
import type { TemplateModule } from "@/core/contracts";
import { ArticleBody } from "@/components/blog/article-body";
import { tagHref } from "@/blog/taxonomy.mjs";
import { dateOf, pondLabels } from "./data";
import { Shell } from "./shell";
import s from "./pond.module.css";
import a from "./article.module.css";

// An article: its date and title on the water, the text on the bank in a reading column aligned with the title,
// its topics in a quiet rail beside it on wide screens (above it on narrow ones).
const BlogPost: TemplateModule["BlogPost"] = ({ post, afterArticle, context }) => {
  const labels = pondLabels(context);
  const description = post.description && post.description !== post.subtitle ? post.description : null;
  return (
    <Shell
      context={context}
      current="blog"
      head={
        <>
          <p className={s.kicker}>
            <time dateTime={post.date}>{dateOf(post.date, context.site.identity.locale)}</time>
            <span aria-hidden="true"> · </span>
            {post.readingMinutes} {labels.minutes}
          </p>
          <h1 className={`${s.title} ${a.title}`}>{post.title}</h1>
          {post.subtitle && <p className={s.lead}>{post.subtitle}</p>}
        </>
      }
    >
      <div className={a.layout}>
        <div className={a.main}>
          <article>
            {description && <p className={a.dek}>{description}</p>}
            <div className={a.body}>
              <ArticleBody post={post} />
            </div>
          </article>
          <div className={a.after}>{afterArticle}</div>
          <p className={a.back}>
            <Link className={s.link} href="/blogs">
              <span aria-hidden="true">← </span>
              {labels.blog}
            </Link>
          </p>
        </div>
        {post.tags.length > 0 && (
          <ul className={a.tags}>
            {post.tags.map((tag) => (
              <li key={tag}>
                <Link className={a.tag} href={tagHref(tag)}>
                  {tag}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Shell>
  );
};
export default BlogPost;
