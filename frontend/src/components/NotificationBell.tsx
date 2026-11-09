"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { api, type NotificationFeed, type NotificationItem } from "@/lib/api";

function timeAgo(iso: string | undefined): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Soften ISO timestamps so notification cards wrap cleanly. */
function readableBody(body: string | null | undefined): string {
  if (!body) return "";
  return body.replace(/\d{4}-\d{2}-\d{2}T[\d:.+-]+Z?/g, (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  });
}

const EMPTY: NotificationFeed = { items: [], unread: 0 };
const PANEL_W = 384;
const PANEL_GAP = 8;
const VIEW_PAD = 12;

type PanelPos = { top: number; left: number; maxHeight: number; placement: "above" | "below" };

export function NotificationBell({
  placement = "auto",
}: {
  /** Hint for preferred open direction; viewport space still wins. */
  placement?: "auto" | "top" | "bottom";
}) {
  const router = useRouter();
  const titleId = useId();
  const [feed, setFeed] = useState<NotificationFeed>(EMPTY);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [pos, setPos] = useState<PanelPos | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getNotifications();
      setFeed(data);
    } catch {
      /* 401 redirect handled inside api.request */
    }
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const updatePos = useCallback(() => {
    const el = buttonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const spaceBelow = vh - rect.bottom - VIEW_PAD;
    const spaceAbove = rect.top - VIEW_PAD;

    let preferBelow = spaceBelow >= 280 || spaceBelow >= spaceAbove;
    if (placement === "top") preferBelow = spaceBelow >= 180;
    if (placement === "bottom") preferBelow = spaceAbove < 180;

    const available = preferBelow ? spaceBelow : spaceAbove;
    const maxHeight = Math.min(480, Math.max(200, available - PANEL_GAP));
    let left = rect.right - PANEL_W;
    left = Math.min(Math.max(VIEW_PAD, left), vw - PANEL_W - VIEW_PAD);

    if (preferBelow) {
      setPos({ top: rect.bottom + PANEL_GAP, left, maxHeight, placement: "below" });
    } else {
      setPos({
        top: Math.max(VIEW_PAD, rect.top - PANEL_GAP - maxHeight),
        left,
        maxHeight,
        placement: "above",
      });
    }
  }, [placement]);

  useLayoutEffect(() => {
    if (!open || isMobile) return;
    updatePos();
  }, [open, isMobile, updatePos, feed.items.length]);

  useEffect(() => {
    if (!open || isMobile) return;
    function onReposition() {
      updatePos();
    }
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, isMobile, updatePos]);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const openItem = async (item: NotificationItem) => {
    if (!item.read && item.id) {
      try {
        await api.markNotificationRead(item.id);
        setFeed((f) => ({
          items: f.items.map((i) => (i.id === item.id ? { ...i, read: true } : i)),
          unread: Math.max(0, f.unread - 1),
        }));
      } catch {
        /* ignore */
      }
    }
    setOpen(false);
    if (item.link?.startsWith("/")) router.push(item.link);
  };

  const markAll = async () => {
    try {
      await api.markAllNotificationsRead();
      setFeed((f) => ({ items: f.items.map((i) => ({ ...i, read: true })), unread: 0 }));
    } catch {
      /* ignore */
    }
  };

  const list = (
    <>
      {feed.items.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-400">You&apos;re all caught up.</p>
      ) : (
        feed.items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => openItem(item)}
            className={`block w-full border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 ${
              item.read ? "bg-white" : "bg-sky-50/50"
            }`}
          >
            <div className="flex items-start gap-2.5">
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                  item.read ? "bg-transparent" : "bg-red-500"
                }`}
              />
              <div className="min-w-0 flex-1">
                <div
                  className={`break-words text-sm leading-snug text-slate-900 ${
                    item.read ? "font-normal" : "font-semibold"
                  }`}
                >
                  {item.title}
                </div>
                {item.body && (
                  <div className="mt-1 break-words text-xs leading-relaxed text-slate-500">
                    {readableBody(item.body)}
                  </div>
                )}
                <div className="mt-1 text-[11px] text-slate-400">{timeAgo(item.createdAt)}</div>
              </div>
            </div>
          </button>
        ))
      )}
    </>
  );

  const header = (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
      <span id={titleId} className="min-w-0 truncate text-sm font-semibold text-slate-900">
        Notifications
        {feed.unread > 0 && (
          <span className="ml-2 inline-flex rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
            {feed.unread}
          </span>
        )}
      </span>
      <div className="flex shrink-0 items-center gap-2">
        {feed.unread > 0 && (
          <button
            type="button"
            onClick={markAll}
            className="whitespace-nowrap text-xs font-medium text-sky-700 hover:text-sky-900"
          >
            Mark all read
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          aria-label="Close notifications"
        >
          Close
        </button>
      </div>
    </div>
  );

  const panel = open && mounted
    ? createPortal(
        isMobile ? (
          <div className="fixed inset-0 z-[80] flex flex-col bg-slate-950/50" role="presentation">
            <button
              type="button"
              className="min-h-[10vh] flex-1"
              aria-label="Dismiss notifications"
              onClick={() => setOpen(false)}
            />
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl"
              style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
              {header}
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{list}</div>
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              className="fixed inset-0 z-[80] cursor-default bg-slate-950/20"
              aria-label="Dismiss notifications"
              onClick={() => setOpen(false)}
            />
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="fixed z-[90] flex w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
              style={{
                top: pos?.top ?? VIEW_PAD,
                left: pos?.left ?? VIEW_PAD,
                maxHeight: pos?.maxHeight ?? 480,
              }}
            >
              {header}
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{list}</div>
            </div>
          </>
        ),
        document.body,
      )
    : null;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {feed.unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] font-bold leading-4 text-white">
            {feed.unread > 99 ? "99+" : feed.unread}
          </span>
        )}
      </button>
      {panel}
    </div>
  );
}
