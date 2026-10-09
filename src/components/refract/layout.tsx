import type { CSSProperties, ReactNode } from "react";
import type { TemplateContext } from "@/core/contracts";
import { themeVariables, type StylePreset } from "./lib/scene-theme";
import "./styles.css";

export function RefractLayout({
  children,
  slots,
  style,
}: {
  children: ReactNode;
  context: TemplateContext;
  slots: { footer: ReactNode; floating: ReactNode };
  style: StylePreset;
}) {
  return (
    <>
      <div
        className="refract-site portfolio-site"
        data-style={style}
        style={themeVariables(style) as CSSProperties}
      >
        {children}
      </div>
      {slots.footer}
      {slots.floating}
    </>
  );
}
