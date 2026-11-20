import type { TemplateModule } from "@/core/contracts";
import { postsOf, stackLabels } from "./data";
import { Shell, Tags } from "./blog";
import { Contents, Sheet } from "./parts/contents";

const BlogTag: TemplateModule["BlogTag"] = ({ tag, context }) => {
  const labels = stackLabels(context);
  return (
    <Shell context={context} current="writing">
      <Sheet as="h1" land={false} label={labels.writing} heading={tag.label}>
        <Tags labels={tag.labels} active={tag.label} all={labels.allWriting} />
        <Contents
          posts={postsOf(tag.posts, context.site.identity.locale, labels)}
        />
      </Sheet>
    </Shell>
  );
};
export default BlogTag;
