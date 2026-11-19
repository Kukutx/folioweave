import Link from "next/link";
import type { TemplateModule } from "@/core/contracts";
import { ArticleBody } from "@/components/blog/article-body";
import { tagHref } from "@/blog/taxonomy.mjs";
import { stackLabels } from "./data";
import { Shell, dateOf } from "./blog";
import * as I from "./icons";
import s from "./stack.module.css";
import b from "./blog.module.css";

const BlogPost: TemplateModule["BlogPost"] = ({ post, afterArticle, context }) => {
  const labels = stackLabels(context);
  return (
    <Shell context={context}>
      <article>
        <header className={b.head}>
          <p className={`${s.label} ${b.meta}`}>
            <time dateTime={post.date}>{dateOf(post.date, context.site.identity.locale)}</time>
            <span className={b.mins}>
              <I.Clock />
              {post.readingMinutes} {labels.minutes}
            </span>
          </p>
          <h1 className={b.title}>{post.title}</h1>
          {post.subtitle && <p className={b.subtitle}>{post.subtitle}</p>}
          {post.description && <p className={s.text}>{post.description}</p>}
          {post.tags.length > 0 && (
            <p className={b.tags}>
              {post.tags.map((tag) => (
                <Link key={tag} href={tagHref(tag)}>
                  {tag}
                </Link>
              ))}
            </p>
          )}
        </header>
        <div className={b.body}>
          <ArticleBody post={post} />
        </div>
      </article>
      <div className={b.after}>{afterArticle}</div>
      <p className={b.back}>
        <Link href="/blogs">← {labels.allWriting}</Link>
      </p>
    </Shell>
  );
};
export default BlogPost;
