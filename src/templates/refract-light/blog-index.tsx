import type { TemplateModule } from "@/core/contracts";
import { RefractBlogIndex } from "@/components/refract-blog/views";

const BlogIndex: TemplateModule["BlogIndex"] = (props) => (
  <RefractBlogIndex {...props} style="light" />
);
export default BlogIndex;
