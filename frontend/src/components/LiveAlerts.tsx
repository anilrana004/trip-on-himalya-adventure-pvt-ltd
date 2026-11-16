"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { api, type NotificationItem } from "@/lib/api";
import {
  isAudioUnlocked,
  isNotifySoundEnabled,
  loadSeenNotificationIds,
  markAudioUnlocked,
  saveSeenNotificationIds,
  setNotifySoundEnabled,
} from "@/lib/notifyPrefs";

type Toast = {
  id: string;
  title: string;
  body: string;
  link?: string | null;
  kind: "followup" | "message" | "other";
};

function kindOf(n: NotificationItem): Toast["kind"] {
  const t = (n.title || "").toLowerCase();
  if (t.includes("follow-up due") || t.includes("follow-ups")) return "followup";
  if (t.includes("whatsapp") || t.includes("message") || t.includes("email") || t.includes("sms")) return "message";
  return "other";
}

/** Soft chime via Web Audio (no asset file). No-ops if locked/muted. */
function playChime() {
  if (!isNotifySoundEnabled() || !isAudioUnlocked()) return;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
    void ctx.resume();
  } catch {
    /* browser blocked */
  }
}

/**
 * Polls the notification feed (no WebSocket in this CRM).
 * Shows toast pop-ups for due follow-ups and inbound messages; optional chime.
 */
export function LiveAlerts() {
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [soundOn, setSoundOn] = useState(true);
  const [needUnlock, setNeedUnlock] = useState(false);
  const [mounted, setMounted] = useState(false);
  const seenRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);

  useEffect(() => {
    setMounted(true);
    setSoundOn(isNotifySoundEnabled());
    setNeedUnlock(!isAudioUnlocked());
    seenRef.current = loadSeenNotificationIds();
  }, []);

  const unlock = useCallback(() => {
    markAudioUnlocked();
    setNeedUnlock(false);
    playChime();
  }, []);

  useEffect(() => {
    function onFirstGesture() {
      if (!isAudioUnlocked()) {
        markAudioUnlocked();
        setNeedUnlock(false);
      }
    }
    window.addEventListener("pointerdown", onFirstGesture, { once: true });
    window.addEventListener("keydown", onFirstGesture, { once: true });
    return () => {
      window.removeEventListener("pointerdown", onFirstGesture);
      window.removeEventListener("keydown", onFirstGesture);
    };
  }, []);

  const poll = useCallback(async () => {
    try {
      const feed = await api.getNotifications(true);
      const items = feed.items ?? [];
      if (!primedRef.current) {
        for (const n of items) {
          if (n.id) seenRef.current.add(n.id);
        }
        saveSeenNotificationIds(seenRef.current);
        primedRef.current = true;
        return;
      }
      const fresh: Toast[] = [];
      for (const n of items) {
        if (!n.id || seenRef.current.has(n.id)) continue;
        seenRef.current.add(n.id);
        const kind = kindOf(n);
        fresh.push({
          id: n.id,
          title: n.title || "Notification",
          body: n.body || "",
          link: n.link,
          kind,
        });
        if (kind === "message") playChime();
      }
      if (fresh.length) {
        saveSeenNotificationIds(seenRef.current);
        setToasts((prev) => [...fresh, ...prev].slice(0, 5));
      }
    } catch {
      /* ignore transient */
    }
  }, []);

  useEffect(() => {
    void poll();
    const timer = setInterval(() => void poll(), 15_000);
    return () => clearInterval(timer);
  }, [poll]);

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setNotifySoundEnabled(next);
  }

  if (!mounted) return null;

  return createPortal(
    <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[min(100vw-2rem,22rem)] flex-col gap-2">
      {needUnlock && (
        <button
          type="button"
          onClick={unlock}
          className="pointer-events-auto rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-left text-xs font-medium text-amber-900 shadow-lg"
        >
          Enable notification sound — browsers block audio until you click once.
        </button>
      )}
      <div className="pointer-events-auto flex justify-end">
        <button
          type="button"
          onClick={toggleSound}
          className="rounded-full border border-slate-200 bg-white/95 px-3 py-1 text-[11px] font-semibold text-slate-600 shadow"
          title={soundOn ? "Mute message sounds" : "Unmute message sounds"}
        >
          {soundOn ? "Sound on" : "Sound muted"}
        </button>
      </div>
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-slate-900">{t.title}</div>
              <p className="mt-1 line-clamp-3 text-xs text-slate-600">{t.body}</p>
            </div>
            <button type="button" onClick={() => dismiss(t.id)} className="text-slate-400 hover:text-slate-700">
              ×
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {t.link && (
              <button
                type="button"
                onClick={() => {
                  dismiss(t.id);
                  router.push(t.link!);
                }}
                className="rounded-lg bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white"
              >
                {t.kind === "followup" ? "Open lead" : "Open conversation"}
              </button>
            )}
            {t.kind === "followup" && (
              <button
                type="button"
                onClick={() => {
                  dismiss(t.id);
                  router.push("/follow-ups");
                }}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700"
              >
                Follow-ups desk
              </button>
            )}
          </div>
        </div>
      ))}
    </div>,
    document.body,
  );
}
