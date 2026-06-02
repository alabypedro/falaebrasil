import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = "BDt5ZLb_hKTf3nNeyXXy8m8ezXv_rPTWnBQMBP8m2nq5IswSr1rb1sBNZSstLnr61Np1Rsl3htpUAPh_YG6AG6k";

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
    const registration = await navigator.serviceWorker.ready;
    
    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Store subscription in Supabase
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert({
        user_id: user.id,
        subscription_data: subscription.toJSON(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id, subscription_data->>endpoint"
      });

    if (error) throw error;
    
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
