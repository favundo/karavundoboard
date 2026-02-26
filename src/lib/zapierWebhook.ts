const STORAGE_KEY = "zapier_webhook_url";

export const getWebhookUrl = (): string => {
  return localStorage.getItem(STORAGE_KEY) || "";
};

export const setWebhookUrl = (url: string) => {
  localStorage.setItem(STORAGE_KEY, url);
};

export const triggerWebhook = async (action: string, details: { table: string; count: number }) => {
  const url = getWebhookUrl();
  if (!url) return;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      mode: "no-cors",
      body: JSON.stringify({
        action,
        table: details.table,
        items_count: details.count,
        timestamp: new Date().toISOString(),
        triggered_from: window.location.origin,
      }),
    });
  } catch (err) {
    console.error("Zapier webhook error:", err);
  }
};
