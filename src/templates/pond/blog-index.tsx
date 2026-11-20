import type { TemplateModule } from "@/core/contracts";
import { Head, Shell } from "./shell";
import { PostList, Topics } from "./writing";

const BlogIndex: TemplateModule["BlogIndex"] = ({ posts, context }) => {
  const topics = [...new Set(posts.flatMap((post) => [...post.tags]))].sort((x, y) =>
    x.localeCompare(y, context.site.identity.locale),
  );
  return (
    <Shell
      context={context}
      current="blog"
      head={<Head title={context.writing.heading ?? context.writing.title} lead={context.writing.description} />}
    >
      <Topics labels={topics} context={context} />
      <PostList posts={posts} context={context} />
    </Shell>
  );
};
export default BlogIndex;
