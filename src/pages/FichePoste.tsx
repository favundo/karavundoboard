import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Monitor, Wifi, WifiOff, Settings, Download } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

const SOURCE_BADGE: Record<string, string> = {
  'Siège':       'bg-blue-100 text-blue-800',
  'ABcroisière': 'bg-purple-100 text-purple-800',
  'Agences':     'bg-emerald-100 text-emerald-800',
  'Stock':       'bg-orange-100 text-orange-800',
};

// ── Contenu des fichiers de configuration à distribuer aux techs ──────────────

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

// ── Composant ─────────────────────────────────────────────────────────────────

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

  const dns: string | null = asset?.dns ?? null;

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

          {/* Panneau setup */}
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

      {/* Contenu de la fiche — à définir */}
      {!isLoading && (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-12 text-center text-muted-foreground">
          Contenu de la fiche — à définir
        </div>
      )}
    </div>
  );
}
