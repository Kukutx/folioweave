import type { TemplateModule } from "@/core/contracts";
import { stackLabels } from "./data";
import { PostRows, Shell, Tags } from "./blog";
import s from "./stack.module.css";
import b from "./blog.module.css";

const BlogTag: TemplateModule["BlogTag"] = ({ tag, context }) => {
  const labels = stackLabels(context);
  return (
    <Shell context={context}>
      <header className={b.head}>
        <p className={s.label}>{labels.writing}</p>
        <h1 className={b.title}>{tag.label}</h1>
      </header>
      <Tags labels={tag.labels} active={tag.label} all={labels.allWriting} />
      <section className={b.list}>
        <PostRows posts={tag.posts} context={context} />
      </section>
    </Shell>
  );
};
export default BlogTag;
