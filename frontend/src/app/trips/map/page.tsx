"use client";

import { Protected } from "@/components/Protected";
import { RouteDesk } from "@/components/treks/RouteDesk";

export default function Page() {
  return (
    <Protected>
      <RouteDesk />
    </Protected>
  );
}
