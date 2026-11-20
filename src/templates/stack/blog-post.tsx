import Link from "next/link";
import type { TemplateModule } from "@/core/contracts";
import { ArticleBody } from "@/components/blog/article-body";
import { tagHref } from "@/blog/taxonomy.mjs";
import { mediaDimensions } from "@/portfolio/media";
import { dateFormat, stackLabels } from "./data";
import { Shell } from "./blog";
import { ArrowLeft } from "./parts/icons";
import s from "./stack.module.css";
import b from "./blog.module.css";

function coverOf(src: string | undefined) {
  if (!src) return null;
  try {
    return { src, ...mediaDimensions(src) };
  } catch {
    return null;
  }
}

/** The article typed on one long sheet; the comments, when a plugin brings them, under it. */
const BlogPost: TemplateModule["BlogPost"] = ({
  post,
  afterArticle,
  context,
}) => {
  const labels = stackLabels(context);
  const locale = context.site.identity.locale;
  const day = post.date.slice(0, 10);
  const cover = coverOf(post.cover);
  return (
    <Shell context={context} current="writing">
      <article className={b.article}>
        <header className={b.head}>
          <p className={b.meta}>
            <time dateTime={day}>
              {post.displayDate ??
                dateFormat(locale).format(new Date(`${day}T00:00:00Z`))}
            </time>
            <span aria-hidden="true"> · </span>
            <span>
              {post.readingMinutes} {labels.minutes}
            </span>
          </p>
          <h1 className={b.title}>{post.title}</h1>
          {post.subtitle && <p className={b.subtitle}>{post.subtitle}</p>}
          {post.description && post.description !== post.subtitle && (
            <p className={b.lede}>{post.description}</p>
          )}
          {post.tags.length > 0 && (
            <p className={b.topics}>
              {post.tags.map((tag) => (
                <Link key={tag} href={tagHref(tag)}>
                  {tag}
                </Link>
              ))}
            </p>
          )}
        </header>
        {cover && (
          <figure className={b.cover}>
            <img
              src={cover.src}
              width={cover.width}
              height={cover.height}
              alt=""
              decoding="async"
            />
          </figure>
        )}
        <div className={b.body}>
          <ArticleBody post={post} />
        </div>
      </article>
      {afterArticle && <div className={b.after}>{afterArticle}</div>}
      <p className={b.back}>
        <Link href="/blogs" className={s.button}>
          <ArrowLeft />
          {labels.allWriting}
        </Link>
      </p>
    </Shell>
  );
};
export default BlogPost;
