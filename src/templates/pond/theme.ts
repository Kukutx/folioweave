// Day or night. The site element carries the visitor's choice as data-theme ("light" or "dark") and the author's
// default as data-default ("system", "light" or "dark"); host.css turns either into the page's colour scheme. React
// never renders data-theme, so the inline script below restores a choice while the page is parsed (no flash of the
// other time of day on a reload) and the switch changes it without a re-render.

export const THEME_KEY = "pond-theme";
export type Time = "light" | "dark";

/** Runs while the page is parsed, inside the site element. */
export const restoreThemeScript = `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==="light"||t==="dark")document.currentScript.parentNode.setAttribute("data-theme",t)}catch(e){}`;
