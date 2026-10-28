"use client";

import { Protected } from "@/components/Protected";
import { ReviewsDesk } from "@/components/treks/ReviewsDesk";

export default function Page() {
  return (
    <Protected>
      <ReviewsDesk />
    </Protected>
  );
}
