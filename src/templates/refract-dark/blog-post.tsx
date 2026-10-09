import type { TemplateModule } from "@/core/contracts";
import { RefractBlogPost } from "@/components/refract-blog/views";

const BlogPost: TemplateModule["BlogPost"] = (props) => (
  <RefractBlogPost {...props} style="dark" />
);
export default BlogPost;
