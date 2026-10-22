import { AboutSection } from "@/templates/classic/about-section";
import { MediaCarousel } from "@/components/media/media-carousel";
import { ScreenRow } from "@/components/media/screen-row";
import { MarkdownBlogPostPage } from "@/components/blog/markdown-blog-post";
import { portfolio } from "@/portfolio";
import "@/templates/classic/styles.css";
import "@/styles/blogs.css";
import { CarouselStates } from "./carousel-states";

const portrait = portfolio.hero.portraits[0];
const images = [
  { src: portrait, alt: "Portrait test artwork" },
  { src: "/media/brink-work-desktop.jpg", alt: "Landscape test artwork" },
];
const screens = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    src: portrait,
    alt: `Screen ${index + 1}`,
  }));

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
      <section id="fixture-screens" className="container">
        <ScreenRow screens={screens(3)} label="Three screens" />
      </section>
      <section id="fixture-screens-many" className="container">
        <ScreenRow screens={screens(5)} label="Five screens" />
      </section>
      <section id="fixture-screens-single" className="container">
        <ScreenRow screens={screens(1)} frame="none" label="One screen" />
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
          headings: [
            { depth: 2, text: "Responsive content", id: "responsive-content" },
            { depth: 3, text: "Wide tables", id: "wide-tables" },
            { depth: 2, text: "Long code lines", id: "long-code-lines" },
          ],
          content: `## Responsive content\n\n![Portrait test artwork](${portrait})\n\n### Wide tables\n\n| Column | Value |\n| --- | --- |\n| Image | Portrait |\n\n## Long code lines\n\n\`\`\`ts\nconst example = 'A deliberately long line to exercise code block horizontal scrolling without overflowing the page';\n\`\`\``,
        }}
      />
    </main>
  );
}
