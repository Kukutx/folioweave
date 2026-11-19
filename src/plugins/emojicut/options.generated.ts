// Generated from manifest.json by scripts/plugin-contracts.mjs. Do not edit.

export interface EmojiCutOptions {
  /**
   * Offer AI sticker design with the visitor's own Gemini API key. Cutting works either way.
   */
  ai?: boolean;
  /**
   * Gemini model that designs the sticker sheet (Nano Banana Pro by default). Any image-output model id from https://ai.google.dev/gemini-api/docs/models.
   */
  imageModel?: string;
  /**
   * Fast Gemini model that names each AI-designed sticker for the ZIP.
   */
  namingModel?: string;
}

export const optionDefaults = {
  ai: true,
  imageModel: "gemini-3-pro-image",
  namingModel: "gemini-3.5-flash-lite",
} satisfies Partial<EmojiCutOptions>;
