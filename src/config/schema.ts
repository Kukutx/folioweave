import type { PortfolioConfig } from "@/portfolio/schema";

export type AbsoluteHttpUrl = `http://${string}` | `https://${string}`;
export type InternalPath = `/${string}`;
export type HashPath = `#${string}`;
export type EmailAddress = `${string}@${string}.${string}`;
export type HexColor = `#${string}`;
export type LocaleCode = `${string}-${string}`;
export type TimeZoneId = `${string}/${string}`;
export type TwitterHandle = `@${string}`;
export type SocialIconName = PortfolioConfig["site"]["socialLinks"][number]["icon"];

export type AppStoreLinks =
  | AbsoluteHttpUrl
  | {
      portfolio: AbsoluteHttpUrl;
      product: AbsoluteHttpUrl;
    };

export type ProductDefinition = {
  name: string;
  route?: InternalPath;
  storyRoute?: InternalPath;
  privacyRoute?: InternalPath;
  icon?: InternalPath;
  appStore?: AppStoreLinks;
  store?: AbsoluteHttpUrl;
  press?: AbsoluteHttpUrl;
  supportEmail?: EmailAddress;
  award?: string;
};
