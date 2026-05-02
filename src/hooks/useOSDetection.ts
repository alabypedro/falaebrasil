import { useMemo } from "react";

export type DevicePlatform = "ios" | "android" | "desktop";

export function detectPlatform(): DevicePlatform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  // iPadOS 13+ reports as Mac with touch — detect via maxTouchPoints
  const isIpadOS =
    /Macintosh/.test(ua) &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1;
  if (/iPad|iPhone|iPod/.test(ua) || isIpadOS) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export function useOSDetection(): DevicePlatform {
  return useMemo(detectPlatform, []);
}

export const PLATFORM_LABELS: Record<DevicePlatform, string> = {
  ios: "iOS (iPhone/iPad)",
  android: "Android",
  desktop: "Desktop / PC",
};