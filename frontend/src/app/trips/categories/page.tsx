"use client";

import { Protected } from "@/components/Protected";
import { CategoriesDesk } from "@/components/treks/CategoriesDesk";

export default function Page() {
  return (
    <Protected>
      <CategoriesDesk />
    </Protected>
  );
}
