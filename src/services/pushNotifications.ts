import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = "BKrhLuxyhd0AehrgK1GbakTJdXqJI7wPcA8g2ELQMmWUeZooWgdjbYrkdItDPlrfiYkBM4MG6xfiKDnGWWN7LZQ";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerPushNotification() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("Push notifications are not supported in this browser.");
    return;
  }

  try {
    // Register service worker
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    console.log("Service Worker registered:", registration);

    // Wait for the service worker to be ready
    await navigator.serviceWorker.ready;
    
    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      console.log("No existing subscription found, subscribing...");
      const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn("User not authenticated, skipping subscription storage");
      return;
    }

    console.log("Storing subscription for user:", user.id);

    // Store subscription in Supabase
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert({
        user_id: user.id,
        subscription_data: subscription.toJSON() as any,
        updated_at: new Date().toISOString(),
      });


    if (error) {
      console.error("Error storing subscription in Supabase:", error);
      throw error;
    }
    
    console.log("Push notification registered successfully");
    return true;
  } catch (error) {
    console.error("Error registering push notification:", error);
    return false;
  }
}

export async function updateLastActivity() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("profiles")
    .update({ last_activity: new Date().toISOString() })
    .eq("id", user.id);
}
