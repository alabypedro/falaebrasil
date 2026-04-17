/**
 * PWA service worker registration with safety guards.
 *
 * The service worker MUST NOT activate inside the Lovable preview iframe
 * or on Lovable preview hosts — it would cache stale builds and break
 * navigation. It only registers in the published/standalone app.
 */

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost = (() => {
  const host = window.location.hostname;
  return (
    host.includes("id-preview--") ||
    host.includes("lovableproject.com") ||
    (host.includes("lovable.app") === false &&
      (host.includes("lovable.dev") || host === "localhost" || host === "127.0.0.1"))
  );
})();

const isLovablePreview =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

export async function setupPWA() {
  // Always clean up service workers in iframe / preview contexts
  if (isInIframe || isLovablePreview) {
    if ("serviceWorker" in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      } catch {
        // ignore
      }
    }
    return;
  }

  if (!("serviceWorker" in navigator)) return;

  try {
    const { registerSW } = await import("virtual:pwa-register");
    registerSW({
      immediate: true,
      onRegisteredSW(_url, registration) {
        // Periodic update check (every hour)
        if (registration) {
          setInterval(() => {
            registration.update().catch(() => {});
          }, 60 * 60 * 1000);
        }
      },
    });
  } catch (err) {
    console.warn("[PWA] registration skipped:", err);
  }
}

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
