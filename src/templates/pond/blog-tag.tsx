import type { TemplateModule } from "@/core/contracts";
import { PostList, Topics } from "./blog";
import { Shell } from "./shell";
import s from "./pond.module.css";

const BlogTag: TemplateModule["BlogTag"] = ({ tag, context }) => (
  <Shell context={context} current="blog">
    <p className={`${s.muted} ${s.small}`}>{context.writing.title}</p>
    <h1 className={s.title}>{tag.label}</h1>
    <Topics labels={tag.labels} active={tag.label} context={context} />
    <PostList posts={tag.posts} context={context} />
  </Shell>
);
export default BlogTag;
