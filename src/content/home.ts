import type { HomeContent } from "./schema";

export const homeContent = {
  greetings: [
    "Hello",
    "Namaste",
    "Bonjour",
    "Hola",
    "Ciao",
    "Olá",
    "Hallo",
    "Guten Tag",
    "Salaam",
    "Konnichiwa",
  ],
  footerBook: {
    title: "PHIL'S-OPHY",
    quote:
      "When life gives you lemonade, make lemons. Life will be all like 'Whaaat?!'",
    author: "Phil Dunphy",
  },
} as const satisfies HomeContent;
