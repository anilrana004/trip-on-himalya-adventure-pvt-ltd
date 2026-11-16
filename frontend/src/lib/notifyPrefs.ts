const SOUND_KEY = "toh.crm.notify.sound";
const UNLOCK_KEY = "toh.crm.notify.audioUnlocked";
const SEEN_KEY = "toh.crm.notify.seenIds";

export function isNotifySoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem(SOUND_KEY);
  return v !== "0";
}

export function setNotifySoundEnabled(on: boolean) {
  localStorage.setItem(SOUND_KEY, on ? "1" : "0");
}

export function isAudioUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(UNLOCK_KEY) === "1";
}

export function markAudioUnlocked() {
  sessionStorage.setItem(UNLOCK_KEY, "1");
}

export function loadSeenNotificationIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr.slice(-200) : []);
  } catch {
    return new Set();
  }
}

export function saveSeenNotificationIds(ids: Set<string>) {
  const arr = [...ids].slice(-200);
  sessionStorage.setItem(SEEN_KEY, JSON.stringify(arr));
}
