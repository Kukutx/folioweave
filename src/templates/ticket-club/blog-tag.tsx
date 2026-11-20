import type { TemplateModule } from "@/core/contracts";
import { Heading, PostTickets, Shell, Tags, clubLabels } from "./blog";

const BlogTag: TemplateModule["BlogTag"] = ({ tag, context }) => {
  const L = clubLabels(context);
  return (
    <Shell context={context}>
      <Heading tagline={L.writing} title={tag.label.toLocaleUpperCase(context.site.identity.locale)} />
      <Tags labels={tag.labels} active={tag.label} all={L.allPosts} />
      <PostTickets posts={tag.posts} context={context} labels={L} />
    </Shell>
  );
};
export default BlogTag;
