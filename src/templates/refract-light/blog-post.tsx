import type { TemplateModule } from "@/core/contracts";
import { RefractBlogPost } from "@/components/refract-blog/views";

const BlogPost: TemplateModule["BlogPost"] = (props) => (
  <RefractBlogPost {...props} style="light" />
);
export default BlogPost;
