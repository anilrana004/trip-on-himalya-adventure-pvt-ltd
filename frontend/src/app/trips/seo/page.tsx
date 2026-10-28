"use client";

import { Protected } from "@/components/Protected";
import { SeoDesk } from "@/components/treks/SeoDesk";

export default function Page() {
  return (
    <Protected>
      <SeoDesk />
    </Protected>
  );
}
