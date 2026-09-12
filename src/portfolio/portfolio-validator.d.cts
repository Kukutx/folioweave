// Generated with the runtime validator. Do not edit directly.
import type { ErrorObject } from "ajv";
import type { PortfolioConfig } from "./schema.generated";

declare function validatePortfolio(data: unknown): data is PortfolioConfig;
declare namespace validatePortfolio {
  let errors: ErrorObject[] | null | undefined;
}
export = validatePortfolio;
