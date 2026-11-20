// Content shapes of the tear-open envelope and its letter. The template fills every text from the
// profile and its options (data.ts); nothing of the original's sample letter ships.
import { stampLabels, type StampLabels } from "./stamps";

export type EnvelopeContent = {
  to: string;
  date: string;
  hint: string;
  opening: string;
  tag: string;
  /** your own stamp artwork (an image URL, 201 × 158) in place of the drawn stamps */
  stamps?: string;
  /** the lettering of the drawn stamps */
  stampLabels: StampLabels;
};
export const envelopeContent: EnvelopeContent = { to: "", date: "", hint: "", opening: "", tag: "", stampLabels };

/** A paragraph of the letter: runs of text, `mark` ones under the highlighter. */
export type LetterParagraph = { text: string; mark?: boolean }[];
export type LetterContent = { title: string; paragraphs: LetterParagraph[] };

// accessible names of the stack's round buttons (not shown)
export const stackLabels = { close: "Close", prev: "Previous", next: "Next" };
