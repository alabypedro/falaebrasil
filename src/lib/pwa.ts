/* ---------------- Install prompt helpers ---------------- */

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(available: boolean) => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    listeners.forEach((fn) => fn(true));
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    listeners.forEach((fn) => fn(false));
  });
}

export function onInstallAvailabilityChange(fn: (available: boolean) => void) {
  listeners.add(fn);
  fn(!!deferredPrompt);
  return () => listeners.delete(fn);
}

export function isInstallPromptAvailable() {
  return !!deferredPrompt;
}

export async function triggerInstallPrompt(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferredPrompt) return "unavailable";
  await deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  listeners.forEach((fn) => fn(false));
  return choice.outcome;
}

export function isAppInstalled() {
  if (typeof window === "undefined") return false;
  // iOS Safari
  // @ts-expect-error - non-standard
  if (window.navigator.standalone) return true;
  // Other browsers
  return window.matchMedia("(display-mode: standalone)").matches;
}

export function getPlatform(): "ios" | "android" | "desktop" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  if (/win|mac|linux/.test(ua)) return "desktop";
  return "other";
}
