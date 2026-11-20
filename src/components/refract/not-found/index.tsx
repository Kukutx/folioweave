import type { TemplateContext } from "@/core/contracts";
import type { StylePreset } from "../lib/scene-theme";
import { carrierWords } from "./content";
import { Carrier } from "./carrier";

/** Refract's 404: the carrier page, in the look the selected style fixes. */
export function RefractNotFound({ context, style }: { context: TemplateContext; style: StylePreset }) {
  return (
    <Carrier
      look={style}
      words={carrierWords(context.site.identity.locale)}
      home={context.site.identity.name}
    />
  );
}
