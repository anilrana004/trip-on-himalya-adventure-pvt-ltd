"use client";

import { Protected } from "@/components/Protected";
import { PackagesDesk } from "@/components/treks/PackagesDesk";

export default function Page() {
  return (
    <Protected>
      <PackagesDesk />
    </Protected>
  );
}
