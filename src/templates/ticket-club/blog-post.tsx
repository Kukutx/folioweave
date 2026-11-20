import Link from "next/link";
import type { TemplateModule } from "@/core/contracts";
import { ArticleBody } from "@/components/blog/article-body";
import { articleTicket, dateOf, fill, labelsOf } from "./data";
import { Tags } from "./blog";
import { Strip } from "./strip";
import s from "./site.module.css";
import g from "./pages.module.css";

/** An article, set for reading on the bill's paper; it ends with a ticket whose stub keeps its link. */
const BlogPost: TemplateModule["BlogPost"] = ({
  post,
  afterArticle,
  context,
}) => {
  const labels = labelsOf(context);
  const locale = context.site.identity.locale;
  return (
    <main id="main" className={s.main}>
      <article className={g.article}>
        <header className={g.articleHead}>
          <p className={`${s.mono} ${g.meta}`}>
            <time dateTime={post.date.slice(0, 10)}>
              {post.displayDate ?? dateOf(post.date, locale)}
            </time>
            <span>
              {post.readingMinutes} {labels.minutes}
            </span>
          </p>
          <h1 className={g.articleTitle}>{post.title}</h1>
          {post.subtitle && <p className={g.articleSub}>{post.subtitle}</p>}
          <Tags labels={post.tags} label={labels.tagged} />
        </header>
        <div className={g.prose}>
          <ArticleBody post={post} />
        </div>
      </article>
      <div className={g.after}>{afterArticle}</div>
      <div className={g.keep}>
        <Strip
          single
          tickets={[articleTicket(context, post)]}
          issuedBy={fill(labels.issuedBy, { name: context.site.identity.name })}
          hint={labels.keepArticle}
          labels={{
            hintIdle: labels.keepArticle,
            copyFailed: labels.copyFailed,
            pull: labels.pull,
            taken: labels.taken,
            again: labels.again,
            stubAction: labels.stubAction,
          }}
        />
        <Link href="/blogs" className={`${s.mono} ${s.more}`}>
          <span aria-hidden>←</span> {labels.allWriting}
        </Link>
      </div>
    </main>
  );
};
export default BlogPost;
