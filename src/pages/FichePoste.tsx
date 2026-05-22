import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Monitor, Wifi, WifiOff, Settings, Download,
  Ticket, Plus, User, KeyRound, Laptop, Clock, ExternalLink,
  Shield, ShieldAlert, ShieldOff, Network, AlertTriangle,
} from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useFicheTicketsRT, useAddTicketRT, useRTTicket, useRTSearch } from '@/hooks/useFicheTicketsRT';
import { useESETComputer } from '@/hooks/useESETComputer';

const SOURCE_BADGE: Record<string, string> = {
  'Siège':       'bg-blue-100 text-blue-800',
  'ABcroisière': 'bg-purple-100 text-purple-800',
  'Agences':     'bg-emerald-100 text-emerald-800',
  'Stock':       'bg-orange-100 text-orange-800',
};

// ── Fichiers de config VNC ────────────────────────────────────────────────────

const PS1_CONTENT = `# launch_vnc.ps1 - Placez ce fichier dans C:\\vnc\\
param([string]$Uri)

# Parsing robuste via [Uri] .NET
try {
    $parsed = [Uri]$Uri
    $target = $parsed.Host
} catch {
    $target = $Uri -replace '^[a-z]+://', '' -replace '/.*$', ''
}

# Lancement direct : /password en clair accepte par UltraVNC (cf. usage officiel)
& "C:\\Program Files\\uvnc bvba\\UltraVNC\\vncviewer.exe" $target /password igl00babar
`;

const REG_CONTENT = `Windows Registry Editor Version 5.00

[HKEY_CLASSES_ROOT\\ultravnc]
@="UltraVNC Viewer"
"URL Protocol"=""

[HKEY_CLASSES_ROOT\\ultravnc\\DefaultIcon]
@="\\"C:\\\\Program Files\\\\uvnc bvba\\\\UltraVNC\\\\vncviewer.exe\\",0"

[HKEY_CLASSES_ROOT\\ultravnc\\shell]

[HKEY_CLASSES_ROOT\\ultravnc\\shell\\open]

[HKEY_CLASSES_ROOT\\ultravnc\\shell\\open\\command]
@="powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File \\"C:\\\\vnc\\\\launch_vnc.ps1\\" \\"%1\\""
`;

// ── Utilitaires ───────────────────────────────────────────────────────────────

function downloadText(content: string, filename: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function launchVNC(dns: string) {
  const a = document.createElement('a');
  a.href = `ultravnc://${dns}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function fetchAsset(source: string, id: string) {
  switch (source) {
    case 'Siège':
      return supabase.from('inventory_items').select('*').eq('id', id).single();
    case 'ABcroisière':
      return supabase.from('abcroisiere_inventory').select('*').eq('id', id).single();
    case 'Agences':
      return supabase.from('agency_inventory').select('*').eq('id', id).single();
    case 'Stock':
      return supabase.from('stock_inventory').select('*').eq('id', id).single();
    default:
      return { data: null, error: new Error('Source inconnue') };
  }
}

const RT_BASE = 'http://rt.in.karavel.com';

const RT_STATUS_BADGE: Record<string, string> = {
  new:      'bg-orange-100 text-orange-800',
  open:     'bg-blue-100 text-blue-800',
  stalled:  'bg-gray-100 text-gray-600',
  resolved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  deleted:  'bg-red-100 text-red-800',
};

function RTStatusBadge({ status }: { status: string }) {
  const cls = RT_STATUS_BADGE[status.toLowerCase()] ?? 'bg-muted text-foreground';
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

function fmt(date: string) {
  return new Date(date).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Sous-composant : carte info ───────────────────────────────────────────────

function InfoCard({
  icon: Icon, label, value, mono = false,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wide">
        <Icon size={12} />
        {label}
      </div>
      <div className={`text-sm font-semibold text-foreground ${mono ? 'font-mono' : ''}`}>
        {value ?? <span className="text-muted-foreground/50 font-normal">—</span>}
      </div>
    </div>
  );
}

// ── Section ESET ──────────────────────────────────────────────────────────────

const ESET_ICON = {
  green:  <Shield size={15} className="text-green-600" />,
  yellow: <ShieldAlert size={15} className="text-yellow-500" />,
  red:    <ShieldOff size={15} className="text-red-500" />,
  gray:   <Shield size={15} className="text-muted-foreground" />,
};

const ESET_BADGE = {
  green:  'bg-green-100 text-green-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  red:    'bg-red-100 text-red-800',
  gray:   'bg-muted text-foreground',
};

function ESETSection({ dns, sn }: { dns: string | null; sn: string | null }) {
  const { data: eset, isLoading, isError } = useESETComputer(dns, sn);

  if (!dns && !sn) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
        <Shield size={15} className="text-primary" />
        ESET PROTECT
      </h2>

      {isLoading && (
        <p className="text-sm text-muted-foreground animate-pulse">Interrogation d'ESET…</p>
      )}

      {(isError || (!isLoading && !eset)) && (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 py-6 text-center text-sm text-muted-foreground">
          Poste non trouvé dans la console ESET
        </div>
      )}

      {eset && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          {/* Ligne statut + bouton console */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              {ESET_ICON[eset.statusColor]}
              <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${ESET_BADGE[eset.statusColor]}`}>
                {eset.statusLabel}
              </span>
              {eset.threats > 0 && (
                <span className="flex items-center gap-1 text-xs font-medium text-red-600">
                  <AlertTriangle size={12} />
                  {eset.threats} menace{eset.threats > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <a
              href={eset.consoleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
            >
              <ExternalLink size={12} />
              Voir dans ESET PROTECT
            </a>
          </div>

          {/* Grille infos */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            {eset.ip && (
              <div className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1 text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  <Network size={11} /> Adresse IP
                </span>
                <span className="font-mono font-semibold">{eset.ip}</span>
              </div>
            )}
            {eset.antivirusVersion && (
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Version AV</span>
                <span className="font-mono text-xs">{eset.antivirusVersion}</span>
              </div>
            )}
            {eset.lastConnectedTime && (
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Dernière connexion</span>
                <span className="text-xs">{fmt(eset.lastConnectedTime)}</span>
              </div>
            )}
            {eset.loggedInUsers && (
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Utilisateur connecté</span>
                <span className="text-xs font-mono">{eset.loggedInUsers}</span>
              </div>
            )}
            {eset.operatingSystem && (
              <div className="flex flex-col gap-0.5 col-span-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">OS détecté par ESET</span>
                <span className="text-xs">{eset.operatingSystem}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Formulaire ajout ticket RT ────────────────────────────────────────────────

function AddTicketForm({
  assetId, source, assetName,
}: {
  assetId: string;
  source: string;
  assetName: string;
}) {
  const [open, setOpen] = useState(false);
  const [ticketRt, setTicketRt] = useState('');
  const [note, setNote] = useState('');
  const [technicien, setTechnicien] = useState('');
  const { mutate, isPending } = useAddTicketRT();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ticketRt.trim()) return;
    mutate(
      { asset_id: assetId, source, asset: assetName, ticket_rt: ticketRt.trim(), note: note.trim() || undefined, technicien: technicien.trim() || undefined },
      {
        onSuccess: () => {
          setTicketRt('');
          setNote('');
          setTechnicien('');
          setOpen(false);
        },
      },
    );
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-1.5">
        <Plus size={14} />
        Associer un ticket RT
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-border bg-card p-4 space-y-3">
      <p className="text-sm font-medium">Nouveau ticket RT</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">N° ticket RT *</label>
          <input
            type="text"
            value={ticketRt}
            onChange={e => setTicketRt(e.target.value)}
            placeholder="ex. 12345"
            required
            className="rounded border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Technicien</label>
          <input
            type="text"
            value={technicien}
            onChange={e => setTechnicien(e.target.value)}
            placeholder="ex. jdupont"
            className="rounded border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Note (optionnel)</label>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Courte description"
            className="rounded border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending || !ticketRt.trim()}>
          {isPending ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function FichePoste() {
  const { source, id } = useParams<{ source: string; id: string }>();
  const navigate = useNavigate();
  const [showSetup, setShowSetup] = useState(false);
  const decodedSource = source ? decodeURIComponent(source) : '';

  const { data: asset, isLoading } = useQuery({
    queryKey: ['fiche-poste', decodedSource, id],
    queryFn: async () => {
      const res = await fetchAsset(decodedSource, id!);
      return res.data as Record<string, any> | null;
    },
    enabled: !!id && !!decodedSource,
  });

  const { data: tickets = [], isLoading: ticketsLoading } = useFicheTicketsRT(id ?? '');

  const dns: string | null = asset?.dns ?? null;
  const sn: string | null = asset?.sn ?? null;
  const lastTicket = tickets[0] ?? null;

  const assetName: string | null = asset?.asset ?? null;
  const uid: string | null = asset?.uid ?? null;
  const nom: string | null = asset?.nom ?? null;
  const { data: rtLive = [], isFetching: rtLiveFetching } = useRTSearch(assetName, uid, nom);

  const { data: rtInfo, isFetching: rtFetching } = useRTTicket(lastTicket?.ticket_rt ?? null);

  return (
    <div className="space-y-6">

      {/* En-tête */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft size={15} className="mr-1.5" />
          Retour
        </Button>
        <div className="flex items-center gap-2">
          <Monitor size={20} className="text-primary" />
          <h1 className="text-xl font-bold text-foreground">Fiche poste de travail</h1>
        </div>
        {decodedSource && (
          <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${SOURCE_BADGE[decodedSource] ?? 'bg-muted text-foreground'}`}>
            {decodedSource}
          </span>
        )}
        {asset?.asset && (
          <span className="font-mono text-sm font-semibold text-muted-foreground">
            {asset.asset}
          </span>
        )}
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground animate-pulse">Chargement…</p>
      )}

      {/* Bouton UltraVNC + setup */}
      {!isLoading && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            {dns ? (
              <Button
                onClick={() => launchVNC(dns)}
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Wifi size={16} />
                Prendre la main (UltraVNC)
              </Button>
            ) : (
              <Button disabled variant="outline" className="gap-2 text-muted-foreground">
                <WifiOff size={16} />
                Pas de nom DNS enregistré
              </Button>
            )}
            {dns && (
              <span className="text-xs text-muted-foreground font-mono">{dns}</span>
            )}
            <button
              onClick={() => setShowSetup(v => !v)}
              className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Settings size={13} />
              {showSetup ? 'Masquer la configuration' : 'Configuration première utilisation'}
            </button>
          </div>

          {showSetup && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 space-y-3 text-sm">
              <p className="font-medium text-amber-900 dark:text-amber-200">
                Configuration à effectuer une seule fois sur chaque poste technicien
              </p>
              <ol className="list-decimal list-inside space-y-1 text-amber-800 dark:text-amber-300">
                <li>Télécharger <strong>launch_vnc.ps1</strong> et le placer dans <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">C:\vnc\</code> (créer le dossier si besoin)</li>
                <li>Télécharger <strong>install_protocole_vnc.reg</strong> et double-cliquer dessus → Oui</li>
                <li>Le protocole <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">ultravnc://</code> est maintenant actif</li>
              </ol>
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline"
                  onClick={() => downloadText(PS1_CONTENT, 'launch_vnc.ps1')}>
                  <Download size={13} className="mr-1.5" />
                  launch_vnc.ps1
                </Button>
                <Button size="sm" variant="outline"
                  onClick={() => downloadText(REG_CONTENT, 'install_protocole_vnc.reg', 'text/plain')}>
                  <Download size={13} className="mr-1.5" />
                  install_protocole_vnc.reg
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grille info */}
      {!isLoading && asset && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <InfoCard
            icon={User}
            label="Collaborateur actuel"
            value={asset.nom || asset.agence}
          />
          <InfoCard
            icon={KeyRound}
            label="UID"
            value={asset.uid}
            mono
          />
          <InfoCard
            icon={Laptop}
            label="Système d'exploitation"
            value={asset.windows_version ?? asset.os_version}
          />
          <InfoCard
            icon={Ticket}
            label="Dernier ticket RT"
            value={
              lastTicket ? (
                <span className="flex flex-col gap-1">
                  <span className="flex items-center gap-1.5">
                    <a
                      href={`${RT_BASE}/Ticket/Display.html?id=${lastTicket.ticket_rt}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-primary hover:underline"
                    >
                      #{lastTicket.ticket_rt}
                    </a>
                    {rtFetching && <span className="text-xs text-muted-foreground animate-pulse">…</span>}
                    {rtInfo && <RTStatusBadge status={rtInfo.status} />}
                  </span>
                  {rtInfo?.subject && (
                    <span className="text-xs font-normal text-muted-foreground line-clamp-2">{rtInfo.subject}</span>
                  )}
                  {rtInfo?.owner && rtInfo.owner !== 'Nobody' && (
                    <span className="text-xs font-normal text-muted-foreground">{rtInfo.owner}</span>
                  )}
                </span>
              ) : null
            }
          />
        </div>
      )}

      {/* Séparateur */}
      {!isLoading && asset && <hr className="border-border" />}

      {/* Section ESET */}
      {!isLoading && asset && <ESETSection dns={dns} sn={sn} />}

      {/* Séparateur */}
      {!isLoading && asset && <hr className="border-border" />}

      {/* 5 derniers tickets RT (recherche live) */}
      {!isLoading && (assetName || uid) && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Ticket size={15} className="text-primary" />
            5 derniers tickets RT
            {rtLiveFetching && <span className="text-xs text-muted-foreground font-normal animate-pulse">Interrogation RT…</span>}
          </h2>

          {!rtLiveFetching && rtLive.length === 0 && (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 py-6 text-center text-sm text-muted-foreground">
              Aucun ticket trouvé dans RT pour cet asset / cet utilisateur
            </div>
          )}

          {rtLive.length > 0 && (
            <div className="rounded-lg border border-border overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    {['Date', 'N° ticket', 'Sujet', 'Statut', 'Assigné à'].map(h => (
                      <th key={h} className="px-3 py-2.5 font-semibold border-b border-border whitespace-nowrap text-xs uppercase tracking-wide text-muted-foreground">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rtLive.map((t, i) => (
                    <tr key={t.id} className={`transition-colors hover:bg-muted/20 ${i % 2 === 1 ? 'bg-muted/10' : ''}`}>
                      <td className="px-3 py-2 border-b border-border/40 text-xs text-muted-foreground whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {fmt(t.created)}
                        </span>
                      </td>
                      <td className="px-3 py-2 border-b border-border/40 font-mono font-semibold">
                        <a
                          href={`${RT_BASE}/Ticket/Display.html?id=${t.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          #{t.id}
                          <ExternalLink size={11} className="text-muted-foreground" />
                        </a>
                      </td>
                      <td className="px-3 py-2 border-b border-border/40 text-muted-foreground max-w-xs truncate">
                        {t.subject || <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-3 py-2 border-b border-border/40">
                        <RTStatusBadge status={t.status} />
                      </td>
                      <td className="px-3 py-2 border-b border-border/40 text-muted-foreground text-xs">
                        {t.owner && t.owner !== 'Nobody' ? t.owner : <span className="text-muted-foreground/40">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!isLoading && asset && <hr className="border-border" />}

      {/* Section tickets RT */}
      {!isLoading && id && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Ticket size={15} className="text-primary" />
              Tickets RT liés manuellement
            </h2>
            <AddTicketForm
              assetId={id}
              source={decodedSource}
              assetName={asset?.asset ?? ''}
            />
          </div>

          {ticketsLoading && (
            <p className="text-sm text-muted-foreground animate-pulse">Chargement…</p>
          )}

          {!ticketsLoading && tickets.length === 0 && (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 py-10 text-center text-sm text-muted-foreground">
              Aucun ticket RT associé à ce poste
            </div>
          )}

          {!ticketsLoading && tickets.length > 0 && (
            <div className="rounded-lg border border-border overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    {['Date', 'N° ticket RT', 'Technicien', 'Note'].map(h => (
                      <th key={h} className="px-3 py-2.5 font-semibold border-b border-border whitespace-nowrap text-xs uppercase tracking-wide text-muted-foreground">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t, i) => (
                    <tr key={t.id} className={`transition-colors hover:bg-muted/20 ${i % 2 === 1 ? 'bg-muted/10' : ''}`}>
                      <td className="px-3 py-2 border-b border-border/40 text-xs text-muted-foreground whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {fmt(t.created_at)}
                        </span>
                      </td>
                      <td className="px-3 py-2 border-b border-border/40 font-mono font-semibold">
                        <a
                          href={`${RT_BASE}/Ticket/Display.html?id=${t.ticket_rt}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          #{t.ticket_rt}
                          <ExternalLink size={11} className="text-muted-foreground" />
                        </a>
                      </td>
                      <td className="px-3 py-2 border-b border-border/40 text-muted-foreground">
                        {t.technicien ?? <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-3 py-2 border-b border-border/40 text-muted-foreground">
                        {t.note ?? <span className="text-muted-foreground/40">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
