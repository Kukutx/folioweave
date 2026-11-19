/**
 * What the page needs from an AI vendor. The UI only talks to this
 * interface; adding a vendor means adding one implementation.
 */
export interface StickerAI {
  /** The vendor's name as visitors know it, e.g. "Gemini". */
  readonly name: string;
  /** Who receives the key and the images, for the privacy note. */
  readonly company: string;
  /** Where a visitor gets a key. */
  readonly keyUrl: string;
  /** localStorage slot for this vendor's key. */
  readonly keyStorage: string;
  /** Designs a sticker sheet from a reference image. */
  designSheet(request: {
    reference: Blob;
    prompt: string;
    apiKey: string;
    signal: AbortSignal;
  }): Promise<Blob>;
  /** A short snake_case name for one sticker; null when there is none. */
  nameSticker(request: {
    image: Blob;
    apiKey: string;
    signal: AbortSignal;
  }): Promise<string | null>;
}

export type AIErrorKind =
  | "badKey"
  | "permission"
  | "quota"
  | "safety"
  | "noImage"
  | "model"
  | "network"
  | "server"
  | "generic";

/** A failure the page can explain; `model` names the model for "model". */
export class AIError extends Error {
  readonly kind: AIErrorKind;
  readonly model?: string;
  constructor(kind: AIErrorKind, message: string, model?: string) {
    super(message);
    this.name = "AIError";
    this.kind = kind;
    this.model = model;
  }
}

/** Base64 of a blob, without the data URL prefix (encoded off the page). */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function base64ToBlob(data: string, type: string): Blob {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}
