"use client";

import { Protected } from "@/components/Protected";
import { ItinerariesDesk } from "@/components/treks/ItinerariesDesk";

export default function Page() {
  return (
    <Protected>
      <ItinerariesDesk />
    </Protected>
  );
}
