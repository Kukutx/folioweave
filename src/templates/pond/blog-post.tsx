import Link from "next/link";
import { Fragment } from "react";
import type { TemplateModule } from "@/core/contracts";
import { ArticleBody } from "@/components/blog/article-body";
import { tagHref } from "@/blog/taxonomy.mjs";
import { pondLabels } from "./data";
import { dateOf } from "./blog";
import { Shell } from "./shell";
import s from "./pond.module.css";
import b from "./blog.module.css";

const BlogPost: TemplateModule["BlogPost"] = ({ post, afterArticle, context }) => {
  const labels = pondLabels(context);
  return (
    <Shell context={context} current="blog">
      <article className={b.article}>
        <header className={b.head}>
          <p className={`${s.muted} ${s.small}`}>
            <time dateTime={post.date}>{dateOf(post.date, context.site.identity.locale)}</time>
            <span className={s.sep}> / </span>
            {post.readingMinutes} {labels.minutes}
          </p>
          <h1 className={s.title}>{post.title}</h1>
          {post.subtitle && <p className={s.text}>{post.subtitle}</p>}
          {post.description && <p className={s.text}>{post.description}</p>}
          {post.tags.length > 0 && (
            <p className={`${s.actions} ${s.small}`}>
              {post.tags.map((tag, i) => (
                <Fragment key={tag}>
                  {i > 0 && <span className={s.sep}> / </span>}
                  <Link className={s.link} href={tagHref(tag)}>
                    {tag}
                  </Link>
                </Fragment>
              ))}
            </p>
          )}
        </header>
        <div className={b.body}>
          <ArticleBody post={post} />
        </div>
      </article>
      <div className={b.after}>{afterArticle}</div>
      <p className={s.back}>
        <Link className={s.link} href="/blogs">
          {labels.blog}
        </Link>
      </p>
    </Shell>
  );
};
export default BlogPost;
