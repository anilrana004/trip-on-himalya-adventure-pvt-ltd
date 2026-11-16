/**
 * Ref-counted body scroll lock for drawers/menus.
 * Nested openers (sidebar + notifications) must not leave overflow:hidden stuck.
 * On iOS, also pin body position so background touch scroll cannot move.
 */
let locks = 0;
let previousOverflow = "";
let previousPosition = "";
let previousTop = "";
let previousWidth = "";
let previousHtmlOverflow = "";
let lockedScrollY = 0;

export function lockBodyScroll(): () => void {
  if (typeof document === "undefined") return () => {};

  if (locks === 0) {
    lockedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    previousOverflow = document.body.style.overflow;
    previousPosition = document.body.style.position;
    previousTop = document.body.style.top;
    previousWidth = document.body.style.width;
    previousHtmlOverflow = document.documentElement.style.overflow;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.width = "100%";
  }
  locks += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks = Math.max(0, locks - 1);
    if (locks === 0) {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousOverflow;
      document.body.style.position = previousPosition;
      document.body.style.top = previousTop;
      document.body.style.width = previousWidth;
      previousOverflow = "";
      previousPosition = "";
      previousTop = "";
      previousWidth = "";
      previousHtmlOverflow = "";
      window.scrollTo(0, lockedScrollY);
    }
  };
}
