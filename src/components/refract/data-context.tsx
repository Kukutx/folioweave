"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { RefractData } from "./data";

const RefractContext = createContext<RefractData | null>(null);
export function RefractProvider({
  data,
  children,
}: {
  data: RefractData;
  children: ReactNode;
}) {
  return (
    <RefractContext.Provider value={data}>{children}</RefractContext.Provider>
  );
}
export function useRefractData() {
  const data = useContext(RefractContext);
  if (!data)
    throw new Error("Refract components require their template data provider.");
  return data;
}
