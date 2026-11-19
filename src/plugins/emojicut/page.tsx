"use client";

import { useMemo } from "react";
import type { PluginPageProps } from "@/core/contracts";
import { createGemini } from "./ai/gemini";
import { copies, langFor } from "./copy";
import { EmojiCut } from "./emojicut";
import { optionDefaults, type EmojiCutOptions } from "./options.generated";

/** /tools/emojicut: the EmojiCut sticker printer. */
export default function EmojiCutPage({
  options,
  context,
}: PluginPageProps<EmojiCutOptions>) {
  const { ai, imageModel, namingModel } = { ...optionDefaults, ...options };
  // Gemini is the one provider today; another vendor is another StickerAI.
  const provider = useMemo(
    () => (ai === false ? null : createGemini({ imageModel, namingModel })),
    [ai, imageModel, namingModel],
  );
  return <EmojiCut copy={copies[langFor(context.locale)]} ai={provider} />;
}
