import type { PortfolioConfig } from "./schema";

/**
 * The contact block, for templates that list "site.contact" under requires:
 * publication refuses a profile without it for them, so this only throws for
 * a template that forgot to declare it.
 */
export function contactOf(site: { contact?: PortfolioConfig["site"]["contact"] }) {
  if (!site.contact)
    throw new Error(
      'This template shows an email address: list "site.contact" under requires in its manifest.',
    );
  return site.contact;
}
