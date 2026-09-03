import type { AboutTimelineItem } from "./schema";

export const aboutTimeline = [
  {
    year: "2011",
    title: "First smartphone",
    desc: "My dad brought home a Galaxy S2. I started noticing how apps looked, moved, and felt.",
  },
  {
    year: "2020",
    title: "Started design",
    desc: "Connected my interests in interfaces, photography, cars, and product craft.",
  },
  {
    year: "2025",
    title: "District by Zomato",
    desc: "Worked on movie-going experiences across discovery and ticketing.",
  },
  {
    year: "2026",
    title: "CRED",
    desc: "Joined CRED as a Product Designer.",
  },
] as const satisfies readonly AboutTimelineItem[];

type StoryTone = "muted" | "strong" | "highlight";
export type AboutStorySegment = { tone: StoryTone; text: string };

export const aboutStory: readonly (readonly AboutStorySegment[])[] = [
  [
    {
      tone: "muted",
      text: "It all started in 2011 when my dad brought home a Samsung Galaxy S2. ",
    },
    {
      tone: "strong",
      text: "I was just a curious kid, spending hours exploring the Play Store, ",
    },
    {
      tone: "muted",
      text: "downloading random apps just to see how they looked and felt. I didn't know the words for it back then, but ",
    },
    { tone: "strong", text: "I was falling in love with " },
    { tone: "highlight", text: "product design" },
    { tone: "strong", text: "." },
  ],
  [
    {
      tone: "muted",
      text: "Before screens took over, I was obsessed with cars and photography. For a very long time, I actually wanted to be an automobile designer. I loved how a car looked fast even when standing still, or how a photo could freeze a feeling forever. ",
    },
    {
      tone: "strong",
      text: "That love for aesthetics and mechanics never really left; it just shifted from engines to interfaces.",
    },
  ],
  [
    {
      tone: "muted",
      text: "During the lockdown, I finally connected the dots. ",
    },
    {
      tone: "strong",
      text: "I realized that building digital products combined everything I loved: how things work, how they look, and how they make people feel. I get to do exactly that every day.",
    },
  ],
];
