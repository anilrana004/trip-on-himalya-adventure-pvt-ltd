"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PayrollRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/finance/payroll");
  }, [router]);
  return <p className="p-6 text-sm text-slate-500">Opening payroll in Finance…</p>;
}
