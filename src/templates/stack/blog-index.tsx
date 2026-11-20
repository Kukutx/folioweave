import type { TemplateModule } from "@/core/contracts";
import { stackLabels } from "./data";
import { PostRows, Shell, Tags } from "./blog";
import s from "./stack.module.css";
import b from "./blog.module.css";

const BlogIndex: TemplateModule["BlogIndex"] = ({ posts, context }) => {
  const labels = stackLabels(context);
  const tags = [...new Set(posts.flatMap((post) => [...post.tags]))].sort((x, y) =>
    x.localeCompare(y, context.site.identity.locale),
  );
  return (
    <Shell context={context}>
      <header className={b.head}>
        <h1 className={s.label}>{labels.writing}</h1>
        <p className={b.title}>{context.writing.heading ?? context.writing.title}</p>
        {context.writing.description && <p className={s.text}>{context.writing.description}</p>}
      </header>
      <Tags labels={tags} all={labels.allWriting} />
      <section className={b.list}>
        <PostRows posts={posts} context={context} />
      </section>
    </Shell>
  );
};
export default BlogIndex;
