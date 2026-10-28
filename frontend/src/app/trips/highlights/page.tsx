"use client";

import { Protected } from "@/components/Protected";
import { HighlightsDesk } from "@/components/treks/HighlightsDesk";

export default function Page() {
  return (
    <Protected>
      <HighlightsDesk />
    </Protected>
  );
}
