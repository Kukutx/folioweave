import Link from "next/link";
import type { TemplateModule } from "@/core/contracts";
import { ArticleBody } from "@/components/blog/article-body";
import { tagHref } from "@/blog/taxonomy.mjs";
import { Shell, clubLabels, dateOf } from "./blog";
import { paperFonts } from "./paper-fonts";
import s from "./ticket-club.module.css";
import b from "./blog.module.css";

/** An article on a sheet of the edition's letter paper. */
const BlogPost: TemplateModule["BlogPost"] = ({ post, afterArticle, context }) => {
  const L = clubLabels(context);
  const locale = context.site.identity.locale;
  return (
    <Shell context={context} className={paperFonts}>
      <article className={b.sheet}>
        <header>
          <p className={b.meta}>
            <time dateTime={post.date}>{post.displayDate ?? dateOf(post.date, locale)}</time>
            <span>{post.readingMinutes} {L.minutes}</span>
          </p>
          <h1 className={b.postTitle}>{post.title}</h1>
          {post.subtitle && <p className={b.postSub}>{post.subtitle}</p>}
          {post.tags.length > 0 && (
            <p className={b.postTags}>
              {post.tags.map((tag) => <Link key={tag} href={tagHref(tag)}>{tag.toLocaleUpperCase(locale)}</Link>)}
            </p>
          )}
        </header>
        <div className={b.body}>
          <ArticleBody post={post} />
        </div>
      </article>
      <div className={b.after}>{afterArticle}</div>
      <p className={`${s.tools} ${b.back}`}>
        <Link className={s.tool} href="/blogs">← {L.writing}</Link>
      </p>
    </Shell>
  );
};
export default BlogPost;
