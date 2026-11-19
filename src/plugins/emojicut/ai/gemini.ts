import {
  AIError,
  base64ToBlob,
  blobToBase64,
  type StickerAI,
} from "./provider";

/**
 * Gemini over REST with the visitor's own key, sent only in the
 * x-goog-api-key header (never in a URL) and only to the Gemini API.
 */
const API = "https://generativelanguage.googleapis.com/v1beta/models";

type Part = {
  text?: string;
  thought?: boolean;
  inlineData?: { mimeType?: string; data?: string };
};
type GenerateResponse = {
  candidates?: Array<{ content?: { parts?: Part[] }; finishReason?: string }>;
  promptFeedback?: { blockReason?: string };
};

const SAFETY_REASONS = new Set([
  "SAFETY",
  "BLOCKLIST",
  "PROHIBITED_CONTENT",
  "SPII",
  "RECITATION",
  "IMAGE_SAFETY",
  "IMAGE_PROHIBITED_CONTENT",
  "IMAGE_RECITATION",
]);

const NAMING_PROMPT =
  "Analyze this sticker. Return a JSON object with a 'filename' property containing a short, descriptive name (max 3 words) in English using snake_case. If there is text, try to capture the meaning or emotion. Example: 'sad_crying', 'thumbs_up', 'working_hard'.";

async function generateContent(
  model: string,
  apiKey: string,
  body: unknown,
  signal: AbortSignal,
): Promise<GenerateResponse> {
  let response: Response;
  try {
    response = await fetch(`${API}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
      signal,
      referrerPolicy: "no-referrer",
      credentials: "omit",
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new AIError("network", String(error));
  }
  if (response.ok) return (await response.json()) as GenerateResponse;

  let status = "";
  let message = "";
  let reason = "";
  try {
    const payload = (await response.json()) as {
      error?: { status?: string; message?: string; details?: Array<{ reason?: string }> };
    };
    status = payload.error?.status ?? "";
    message = payload.error?.message ?? "";
    reason = payload.error?.details?.find((d) => d.reason)?.reason ?? "";
  } catch {
    // Not JSON: classify by status code alone.
  }
  const detail = `${response.status} ${status} ${reason} ${message}`.trim();
  if (
    reason === "API_KEY_INVALID" ||
    /api key (not valid|expired|invalid)/i.test(message) ||
    response.status === 401
  )
    throw new AIError("badKey", detail);
  if (response.status === 403) throw new AIError("permission", detail);
  if (response.status === 429 || status === "RESOURCE_EXHAUSTED")
    throw new AIError("quota", detail);
  if (response.status === 404) throw new AIError("model", detail, model);
  if (response.status >= 500) throw new AIError("server", detail);
  throw new AIError("generic", detail);
}

export function createGemini({
  imageModel,
  namingModel,
}: {
  imageModel: string;
  namingModel: string;
}): StickerAI {
  return {
    name: "Gemini",
    company: "Google",
    keyUrl: "https://aistudio.google.com/app/apikey",
    keyStorage: "folioweave:emojicut:gemini-key",

    async designSheet({ reference, prompt, apiKey, signal }) {
      const data = await blobToBase64(reference);
      const response = await generateContent(
        imageModel,
        apiKey,
        {
          contents: [
            {
              parts: [
                { inlineData: { mimeType: reference.type || "image/png", data } },
                { text: prompt },
              ],
            },
          ],
        },
        signal,
      );
      const block = response.promptFeedback?.blockReason;
      if (block) throw new AIError("safety", block);
      const candidate = response.candidates?.[0];
      for (const part of candidate?.content?.parts ?? [])
        if (part.inlineData?.data && !part.thought)
          return base64ToBlob(part.inlineData.data, part.inlineData.mimeType || "image/png");
      const finish = candidate?.finishReason ?? "";
      if (SAFETY_REASONS.has(finish)) throw new AIError("safety", finish);
      throw new AIError("noImage", finish || "No image returned");
    },

    async nameSticker({ image, apiKey, signal }) {
      try {
        const response = await generateContent(
          namingModel,
          apiKey,
          {
            contents: [
              {
                parts: [
                  { inlineData: { mimeType: "image/png", data: await blobToBase64(image) } },
                  { text: NAMING_PROMPT },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
              responseJsonSchema: {
                type: "object",
                properties: { filename: { type: "string" } },
              },
            },
          },
          signal,
        );
        const text = (response.candidates?.[0]?.content?.parts ?? [])
          .filter((part) => part.text && !part.thought)
          .map((part) => part.text)
          .join("");
        const parsed = text ? (JSON.parse(text) as { filename?: unknown }) : {};
        return typeof parsed.filename === "string" && parsed.filename.trim()
          ? parsed.filename.trim()
          : null;
      } catch (error) {
        if (signal.aborted) throw error;
        console.warn("EmojiCut: naming failed", error);
        return null;
      }
    },
  };
}
