import type { TemplateModule } from "@/core/contracts";
import { Heading, PostTickets, Shell, Tags, clubLabels } from "./blog";

const BlogIndex: TemplateModule["BlogIndex"] = ({ posts, context }) => {
  const L = clubLabels(context);
  const tags = [...new Set(posts.flatMap((post) => [...post.tags]))].sort((x, y) => x.localeCompare(y, context.site.identity.locale));
  return (
    <Shell context={context}>
      <Heading tagline={L.tagline} title={(context.writing.heading ?? context.writing.title).toLocaleUpperCase(context.site.identity.locale)} sub={context.writing.description} />
      <Tags labels={tags} all={L.allPosts} />
      <PostTickets posts={posts} context={context} labels={L} />
    </Shell>
  );
};
export default BlogIndex;
