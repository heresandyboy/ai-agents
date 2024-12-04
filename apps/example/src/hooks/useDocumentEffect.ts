"use client";

import { useEffect } from "react";

export function useDocumentEffect(
  effect: (document: Document) => (() => void) | void,
  deps: any[] = []
) {
  useEffect(() => {
    if (typeof window !== "undefined") {
      return effect(document);
    }
  }, deps);
}
