import type { TemplateModule } from "@/core/contracts";
import { PostList, Topics } from "./blog";
import { Shell } from "./shell";
import s from "./pond.module.css";

const BlogIndex: TemplateModule["BlogIndex"] = ({ posts, context }) => {
  const topics = [...new Set(posts.flatMap((post) => [...post.tags]))].sort((x, y) =>
    x.localeCompare(y, context.site.identity.locale),
  );
  return (
    <Shell context={context} current="blog">
      <h1 className={s.title}>{context.writing.heading ?? context.writing.title}</h1>
      {context.writing.description && <p className={s.lead}>{context.writing.description}</p>}
      <Topics labels={topics} context={context} />
      <PostList posts={posts} context={context} />
    </Shell>
  );
};
export default BlogIndex;
