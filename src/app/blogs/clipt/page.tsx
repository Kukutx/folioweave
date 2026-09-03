import { routeMetadata } from "@/config/seo";
import { CliptBlogPage } from "@/components/clipt-blog-page";
import "@/styles/blogs.css";

export const metadata = routeMetadata.cliptBlog;
export default function Page() {
  return <CliptBlogPage />;
}
