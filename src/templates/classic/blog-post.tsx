import { MarkdownBlogPostPage } from "@/components/blog/markdown-blog-post";
import { BlogBackToTop } from "@/components/blog/blog-back-to-top";
import type { TemplateModule } from "@/core/contracts";

const BlogPost: TemplateModule["BlogPost"] = ({
  post,
  afterArticle,
  context,
}) => (
  <>
    <MarkdownBlogPostPage post={post} afterArticle={afterArticle} />
    <BlogBackToTop locale={context.site.identity.locale} />
  </>
);
export default BlogPost;
