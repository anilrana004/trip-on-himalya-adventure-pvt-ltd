"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ExpensesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/finance/expenses");
  }, [router]);
  return <p className="p-6 text-sm text-slate-500">Opening expenses in Finance…</p>;
}
