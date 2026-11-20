// Words on the carrier 404 page (547 recording), in the site's language as Refract's interface is (copy.ts):
// English by default, Chinese for zh-* profiles. The flight-deck readout is built by deckLine() and stays as
// recorded, like an instrument.

export type CarrierWords = {
  label: string;
  code: string;
  line: string;
  back: string;
  hint: string;
};

const en: CarrierWords = {
  label: "AIRCRAFT CARRIER",
  code: "404",
  line: "This page took off without you.",
  back: "BACK TO THE DECK",
  hint: "DRAG TO TURN",
};

const zh: CarrierWords = {
  label: "航空母舰",
  code: "404",
  line: "这个页面没等你就起飞了。",
  back: "回到甲板",
  hint: "拖动旋转",
};

export const carrierWords = (locale: string): CarrierWords => (/^zh\b/i.test(locale) ? zh : en);

export function deckLine(deck: number, air: number, launch: number) {
  return `deck ${deck} · air ${air} · launch ${String(launch).padStart(2, "0")}s`;
}
