"use client";

import { Protected } from "@/components/Protected";
import { BulkDesk } from "@/components/treks/BulkDesk";

export default function Page() {
  return (
    <Protected>
      <BulkDesk />
    </Protected>
  );
}
