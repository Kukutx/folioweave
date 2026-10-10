import { Fragment } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BlogCardList } from "@/components/blog/blog-card-list";
import { BlogTags } from "@/components/blog/blog-tags";
import { BlogSearch } from "@/components/blog/blog-search";
import { blogSearchDocuments } from "@/blog/search";
import type { BlogPostSummary } from "@/blog/types";
import type { TemplateContext, BlogTagView as TagView } from "@/core/contracts";
import "@/styles/blogs.css";

function Copyright({ context }: { context: TemplateContext }) {
  return (
    <footer className="writing-footer">
      <p>
        © {context.site.copyrightYear} {context.site.identity.name}. All rights
        reserved.
      </p>
    </footer>
  );
}

export function BlogIndexView({
  posts,
  context,
}: {
  posts: BlogPostSummary[];
  context: TemplateContext;
}) {
  const blog = context.writing;
  return (
    <div className="writing-container">
      <header className="writing-header">
        <div>
          <h1 className="writing-title">{blog.heading ?? blog.title}</h1>
          <p className="writing-subtitle">
            {blog.intro?.length
              ? blog.intro.map((segment, index) =>
                  segment.tone === "highlight" ? (
                    <span className="highlight-yellow" key={index}>
                      {segment.text}
                    </span>
                  ) : (
                    <Fragment key={index}>{segment.text}</Fragment>
                  ),
                )
              : blog.description}
          </p>
        </div>
      </header>
      <main className="writing-list-container">
        <BlogCardList posts={posts} />
      </main>
      <Copyright context={context} />
      <BlogSearch
        posts={blogSearchDocuments(posts)}
        locale={context.site.identity.locale}
      />
    </div>
  );
}

export function BlogTagView({
  tag,
  context,
}: {
  tag: TagView;
  context: TemplateContext;
}) {
  return (
    <div className="writing-container">
      <header className="writing-header blog-tag-header">
        <Link href="/blogs" className="back-link">
          <ArrowLeft size={18} /> All posts
        </Link>
        <h1 className="writing-title">{tag.label}</h1>
        <p className="writing-subtitle">
          {tag.posts.length} {tag.posts.length === 1 ? "post" : "posts"} tagged
        </p>
        <BlogTags
          tags={tag.labels}
          current={tag.label}
          className="blog-tag-browser"
          label="All tags"
        />
      </header>
      <main className="writing-list-container">
        <BlogCardList posts={tag.posts} />
      </main>
      <Copyright context={context} />
    </div>
  );
}
