import { AboutSection } from "@/components/about-section";
import { MediaCarousel } from "@/components/media/media-carousel";
import { MarkdownBlogPostPage } from "@/components/blog/markdown-blog-post";
import { portfolio } from "@/portfolio";
import "@/styles/blogs.css";
import { CarouselStates } from "./carousel-states";

const portrait = portfolio.hero.portraits[0];
const images = [
  { src: portrait, alt: "Portrait test artwork" },
  { src: "/media/brink-work-desktop.jpg", alt: "Landscape test artwork" },
];

// This file is copied into an isolated temporary app by qa/visual-fixtures.mjs.
// It is never a route in the production application.
export default function VisualFixtures() {
  return (
    <main>
      <h1>Reusable visual contract</h1>
      <section
        id="fixture-carousel"
        className="container"
        style={{ paddingTop: 100 }}
      >
        <CarouselStates images={images} />
      </section>
      <section id="fixture-single" className="container">
        <MediaCarousel images={images.slice(0, 1)} />
      </section>
      <section id="fixture-empty">
        <MediaCarousel images={[]} />
      </section>
      <AboutSection />
      <MarkdownBlogPostPage
        post={{
          kind: "markdown",
          slug: "visual-fixture",
          href: "/visual-fixture",
          title: "Portrait cover and Markdown content",
          date: "2026-09-08",
          description:
            "A long heading and real images must stay inside the viewport.",
          cover: portrait,
          tags: ["visual", "fixture"],
          readingMinutes: 1,
          content: `## Responsive content\n\n![Portrait test artwork](${portrait})\n\n| Column | Value |\n| --- | --- |\n| Image | Portrait |\n\n\`\`\`ts\nconst example = 'A deliberately long line to exercise code block horizontal scrolling without overflowing the page';\n\`\`\``,
        }}
      />
    </main>
  );
}
