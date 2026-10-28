"use client";

import { Protected } from "@/components/Protected";
import { FaqsDesk } from "@/components/treks/FaqsDesk";

export default function Page() {
  return (
    <Protected>
      <FaqsDesk />
    </Protected>
  );
}
