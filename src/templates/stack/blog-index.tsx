import type { TemplateModule } from "@/core/contracts";
import { postsOf, stackLabels } from "./data";
import { Shell, Tags } from "./blog";
import { Contents, Sheet } from "./parts/contents";

const BlogIndex: TemplateModule["BlogIndex"] = ({ posts, context }) => {
  const labels = stackLabels(context);
  const locale = context.site.identity.locale;
  const tags = [...new Set(posts.flatMap((post) => [...post.tags]))].sort(
    (x, y) => x.localeCompare(y, locale),
  );
  return (
    <Shell context={context} current="writing">
      <Sheet
        as="h1"
        land={false}
        heading={context.writing.heading ?? context.writing.title}
        description={context.writing.description}
      >
        <Tags labels={tags} all={labels.allWriting} />
        <Contents posts={postsOf(posts, locale, labels)} />
      </Sheet>
    </Shell>
  );
};
export default BlogIndex;
