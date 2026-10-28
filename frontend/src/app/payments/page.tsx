"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PaymentsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/finance/payments");
  }, [router]);
  return <p className="p-6 text-sm text-slate-500">Opening collections in Finance…</p>;
}
