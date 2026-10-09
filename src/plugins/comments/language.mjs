const supported = new Set([
  "en",
  "it",
  "fr",
  "de",
  "es",
  "ja",
  "ko",
  "pt",
  "ru",
]);

/** Resolve the site's BCP 47 locale to a language supported by this provider. */
export function discussionLanguage(locale) {
  try {
    const language = new Intl.Locale(locale).maximize();
    if (language.language === "zh")
      return language.script === "Hant" ? "zh-TW" : "zh-CN";
    return supported.has(language.language) ? language.language : "en";
  } catch {
    return "en";
  }
}
