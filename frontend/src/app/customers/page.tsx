"use client";

import { Protected } from "@/components/Protected";
import { CustomersDesk } from "@/components/customers/CustomersDesk";

export default function CustomersPage() {
  return (
    <Protected>
      <CustomersDesk />
    </Protected>
  );
}
