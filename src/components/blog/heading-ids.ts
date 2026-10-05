import type { Element, Root, RootContent } from "hast";
import type { BlogHeading } from "@/blog/types";

const isFootnotes = (node: Element) => "dataFootnotes" in node.properties;

const STALE_OUTLINE =
  "Article headings do not match the generated outline. Run content:build.";

/**
 * Gives the article's sections the anchors the content build assigned, in
 * reading order, each with a link to itself, so the table of contents and the
 * headings can never disagree.
 */
export function rehypeHeadingIds(headings: readonly BlogHeading[]) {
  return (tree: Root) => {
    let next = 0;
    const visit = (node: Root | RootContent) => {
      if (node.type !== "root" && node.type !== "element") return;
      if (node.type === "element") {
        if (isFootnotes(node)) return;
        if (node.tagName === "h2" || node.tagName === "h3") {
          const heading = headings[next++];
          if (heading?.depth !== Number(node.tagName[1]))
            throw new Error(STALE_OUTLINE);
          node.children.forEach(visit);
          node.properties.id = heading.id;
          node.children.push({
            type: "element",
            tagName: "a",
            properties: {
              className: ["heading-anchor"],
              href: `#${heading.id}`,
              ariaLabel: "Link to this section",
            },
            children: [{ type: "text", value: "#" }],
          });
          return;
        }
      }
      node.children.forEach(visit);
    };
    visit(tree);
    if (next !== headings.length) throw new Error(STALE_OUTLINE);
  };
}
