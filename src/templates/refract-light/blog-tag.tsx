import type { TemplateModule } from "@/core/contracts";
import { RefractBlogTag } from "@/components/refract-blog/views";

const BlogTag: TemplateModule["BlogTag"] = (props) => (
  <RefractBlogTag {...props} style="light" />
);
export default BlogTag;
