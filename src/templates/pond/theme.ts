// The visitor's light/dark choice. The site element carries it as data-theme (dark without one); React never
// renders that attribute, so the choice can be restored before the first paint by the inline script below and
// switched later without a re-render of the shell.

export const THEME_KEY = "pond-theme";
export type PondTheme = "dark" | "light";

/** Runs while the page is parsed, inside the site element: no flash of the other theme on a reload. */
export const restoreThemeScript = `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==="light"||t==="dark")document.currentScript.parentNode.setAttribute("data-theme",t)}catch(e){}`;
