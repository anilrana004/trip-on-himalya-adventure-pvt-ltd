"use client";

import { Protected } from "@/components/Protected";
import { MediaDesk } from "@/components/treks/MediaDesk";

export default function Page() {
  return (
    <Protected>
      <MediaDesk />
    </Protected>
  );
}
