"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

function formatElapsed(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

/** Running clock from this browser's sign-in. A page refresh does not start it over. */
export function SessionTimer({ compact = false }: { compact?: boolean }) {
  const [loginAt, setLoginAt] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    api.myPresence()
      .then((row) => {
        if (!cancelled) setLoginAt(row?.open ? row.loginAt : null);
      })
      .catch(() => {
        if (!cancelled) setLoginAt(null);
      });
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(tick);
    };
  }, []);

  if (!loginAt) return null;
  const elapsed = Math.max(0, Math.floor((now - new Date(loginAt).getTime()) / 1000));
  return (
    <div className={compact ? "px-1 text-center text-[10px] text-teal-300" : "px-1 text-xs text-teal-300"}>
      <div className="uppercase tracking-wide text-slate-500">Session</div>
      <div className="font-mono text-sm text-teal-200">{formatElapsed(elapsed)}</div>
    </div>
  );
}
