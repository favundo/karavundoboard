import { useState } from "react";
import { Bell, BellOff, Check, Settings2 } from "lucide-react";
import { getWebhookUrl, setWebhookUrl } from "@/lib/zapierWebhook";

const WebhookSettings = () => {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(getWebhookUrl);
  const [saved, setSaved] = useState(false);

  const hasWebhook = !!getWebhookUrl();

  const handleSave = () => {
    setWebhookUrl(url.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Notifications Zapier"
        className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${
          hasWebhook
            ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
            : "border-border bg-muted/30 text-muted-foreground hover:bg-muted"
        }`}
      >
        {hasWebhook ? <Bell size={15} /> : <BellOff size={15} />}
        <span className="hidden sm:inline">{hasWebhook ? "Notifications activées" : "Notifications"}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center gap-2 border-b border-border px-6 py-4">
              <Settings2 size={18} className="text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Notifications par email (Zapier)</h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-muted-foreground">
                Entrez votre URL de webhook Zapier pour recevoir un email à chaque mise à jour de l'inventaire.
              </p>
              <div>
                <label className="text-xs font-medium text-foreground">URL du Webhook</label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://hooks.zapier.com/hooks/catch/..."
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  <strong>Comment configurer :</strong><br />
                  1. Créez un Zap sur zapier.com<br />
                  2. Ajoutez un trigger "Webhooks by Zapier" → "Catch Hook"<br />
                  3. Ajoutez une action "Email" ou "Gmail" → "Send Email"<br />
                  4. Collez l'URL du webhook ci-dessus
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
              <button onClick={() => setOpen(false)} className="h-9 rounded-lg px-4 text-sm text-muted-foreground hover:text-foreground transition-colors">
                Fermer
              </button>
              <button
                onClick={handleSave}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
              >
                {saved ? <><Check size={14} /> Enregistré</> : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default WebhookSettings;
