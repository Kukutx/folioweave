import type { TemplateModule } from "@/core/contracts";
import { Head, Shell } from "./shell";
import { PostList, Topics } from "./writing";

const BlogTag: TemplateModule["BlogTag"] = ({ tag, context }) => (
  <Shell context={context} current="blog" head={<Head kicker={context.writing.title} title={tag.label} />}>
    <Topics labels={tag.labels} active={tag.label} context={context} />
    <PostList posts={tag.posts} context={context} />
  </Shell>
);
export default BlogTag;
