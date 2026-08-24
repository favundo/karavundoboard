import { useState, useEffect, useMemo } from 'react';
import { Search, ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import DashboardToday from './DashboardToday';
import TicketsByOwner from './TicketsByOwner';

type Source = 'Siège' | 'Groupes Province' | 'ABcroisière' | 'Agences' | 'Stock' | 'Imprimantes';

interface SearchResult {
  id: string;
  source: Source;
  asset: string;
  sn: string | null;
  type: string;
  nom: string | null;
  uid: string | null;
  service: string | null;
  agence: string | null;
  windows_version: string | null;
  eset_app: string | null;
}

/** 50 lignes par table : le plafond réel est ce nombre × le nombre de tables. */
const ROWS_PER_TABLE = 50;
const TABLE_COUNT = 6;
const RESULT_CAP = ROWS_PER_TABLE * TABLE_COUNT;

// `or=` de PostgREST est une liste séparée par des virgules, avec des
// parenthèses comme délimiteurs : ces caractères dans la saisie casseraient le
// filtre (400). On les retire plutôt que d'échapper — ils n'ont aucun sens dans
// un asset, un N/S ou un nom.
const sanitize = (s: string) => s.replace(/[,()"'\\]/g, '');

async function searchAllTables(query: string): Promise<SearchResult[]> {
  const q = `%${sanitize(query)}%`;
  const like = (...cols: string[]) => cols.map(c => `${c}.ilike.${q}`).join(',');

  const [siege, province, abc, agences, stock, printers] = await Promise.all([
    supabase
      .from('inventory_items')
      .select('id,asset,sn,type,nom,uid,service,windows_version,eset_app')
      .or(like('asset', 'sn', 'nom', 'uid', 'service', 'dns', 'matricule', 'pseudo'))
      .limit(ROWS_PER_TABLE),
    supabase
      .from('province_inventory')
      .select('id,asset,sn,type,nom,uid,service,windows_version,eset_app')
      .or(like('asset', 'sn', 'nom', 'uid', 'service', 'dns', 'matricule', 'pseudo'))
      .limit(ROWS_PER_TABLE),
    supabase
      .from('abcroisiere_inventory')
      .select('id,asset,sn,type,nom,uid,service,windows_version,eset_app')
      .or(like('asset', 'sn', 'nom', 'uid', 'service', 'dns', 'matricule', 'pseudo'))
      .limit(ROWS_PER_TABLE),
    supabase
      .from('agency_inventory')
      .select('id,asset,sn,type,agence,dns,os_version,eset_app')
      .or(like('asset', 'sn', 'agence', 'dns', 'sous_reseau'))
      .limit(ROWS_PER_TABLE),
    supabase
      .from('stock_inventory')
      .select('id,asset,sn,type,nom,uid,service,windows_version,eset_app')
      .or(like('asset', 'sn', 'nom', 'uid', 'service', 'dns', 'matricule', 'pseudo'))
      .limit(ROWS_PER_TABLE),
    supabase
      .from('printer_inventory')
      .select('id,asset,sn,modele,fabricant,hostname,ip,service,emplacement')
      .or(like('asset', 'sn', 'modele', 'fabricant', 'hostname', 'ip', 'service', 'emplacement'))
      .limit(ROWS_PER_TABLE),
  ]);

  return [
    ...(siege.data ?? []).map(r => ({ ...r, source: 'Siège' as Source, agence: null })),
    ...(province.data ?? []).map(r => ({ ...r, source: 'Groupes Province' as Source, agence: null })),
    ...(abc.data ?? []).map(r => ({ ...r, source: 'ABcroisière' as Source, agence: null })),
    ...(agences.data ?? []).map(r => ({
      id: r.id,
      source: 'Agences' as Source,
      asset: r.asset,
      sn: r.sn,
      type: r.type,
      nom: null,
      uid: null,
      service: null,
      agence: r.agence,
      windows_version: r.os_version,
      eset_app: r.eset_app,
    })),
    ...(stock.data ?? []).map(r => ({ ...r, source: 'Stock' as Source, agence: null })),
    // Les imprimantes n'ont ni collaborateur ni OS : le modèle sert de type et
    // l'emplacement complète le service.
    ...(printers.data ?? []).map(r => ({
      id: r.id,
      source: 'Imprimantes' as Source,
      asset: r.asset,
      sn: r.sn,
      type: [r.fabricant, r.modele].filter(Boolean).join(' ') || 'Imprimante',
      nom: r.hostname,
      uid: r.ip,
      service: [r.service, r.emplacement].filter(Boolean).join(' — ') || null,
      agence: null,
      windows_version: null,
      eset_app: null,
    })),
  ];
}

const SOURCE_BADGE: Record<Source, string> = {
  'Siège':            'bg-blue-100 text-blue-800',
  'Groupes Province': 'bg-cyan-100 text-cyan-800',
  'ABcroisière':      'bg-purple-100 text-purple-800',
  'Agences':          'bg-emerald-100 text-emerald-800',
  'Stock':            'bg-orange-100 text-orange-800',
  'Imprimantes':      'bg-slate-200 text-slate-800',
};

/** Sources disposant d'une fiche poste (voir fetchAsset dans FichePoste.tsx). */
const HAS_FICHE: Record<Source, boolean> = {
  'Siège': true, 'Groupes Province': true, 'ABcroisière': true,
  'Agences': true, 'Stock': true, 'Imprimantes': false,
};

const Empty = () => <span className="text-muted-foreground/40">—</span>;

type SortKey = 'source' | 'asset' | 'sn' | 'type' | 'nom' | 'uid' | 'lieu' | 'windows_version';

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'source',          label: 'Source' },
  { key: 'asset',           label: 'Asset' },
  { key: 'sn',              label: 'N/S' },
  { key: 'type',            label: 'Type' },
  { key: 'nom',             label: 'Collaborateur' },
  { key: 'uid',             label: 'UID' },
  { key: 'lieu',            label: 'Service / Agence' },
  { key: 'windows_version', label: 'OS' },
];

const cellValue = (r: SearchResult, key: SortKey): string | null =>
  key === 'lieu' ? (r.agence ?? r.service) : (r[key] as string | null);

export default function SupportDashboard() {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (input.length < 2) { setQuery(''); return; }
    const t = setTimeout(() => setQuery(input), 350);
    return () => clearTimeout(t);
  }, [input]);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['global-search', query],
    queryFn: () => searchAllTables(query),
    enabled: query.length >= 2,
  });

  // Sans tri explicite on garde l'ordre naturel : les résultats restent groupés
  // par inventaire, ce qui est l'ordre le plus lisible par défaut.
  const rows = useMemo(() => {
    if (!sort) return results;
    const sign = sort.dir === 'asc' ? 1 : -1;
    return [...results].sort((a, b) => {
      const va = cellValue(a, sort.key);
      const vb = cellValue(b, sort.key);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;   // les vides toujours en bas, quel que soit le sens
      if (vb == null) return -1;
      return sign * va.localeCompare(vb, 'fr', { numeric: true, sensitivity: 'base' });
    });
  }, [results, sort]);

  const toggleSort = (key: SortKey) =>
    setSort(prev =>
      prev?.key !== key ? { key, dir: 'asc' }
        : prev.dir === 'asc' ? { key, dir: 'desc' }
        : null,
    );

  return (
    <div className="space-y-6">
      <DashboardToday />

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Recherche rapide</h2>

        {/* Barre de recherche */}
        <div className="relative max-w-2xl">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Asset, N/S, collaborateur, UID, service, DNS, matricule, agence, imprimante…"
            className="w-full rounded-lg border border-border bg-background pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            autoFocus
          />
          {isFetching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground animate-pulse">
              Recherche…
            </span>
          )}
        </div>

        {/* Compteur */}
        {query && !isFetching && (
          <p className="text-xs text-muted-foreground">
            {results.length} résultat{results.length !== 1 ? 's' : ''} pour «&nbsp;{query}&nbsp;»
            {results.length >= RESULT_CAP && ' — plafond atteint, affinez la recherche'}
          </p>
        )}

        {/* Tableau */}
        {rows.length > 0 && (
          <div className="rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/50 text-left">
                  {COLUMNS.map(({ key, label }) => {
                    const active = sort?.key === key;
                    const Icon = !active ? ChevronsUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
                    return (
                      <th key={key} className="border-b border-border p-0 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleSort(key)}
                          aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                          className="group flex w-full items-center gap-1.5 px-3 py-2.5 font-semibold transition-colors hover:bg-muted"
                        >
                          {label}
                          <Icon
                            size={12}
                            className={active ? 'text-foreground' : 'text-muted-foreground/30 group-hover:text-muted-foreground'}
                          />
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.source}-${r.id}`}
                    className={`transition-colors hover:bg-muted/20 ${i % 2 === 1 ? 'bg-muted/10' : ''}`}>
                    <td className="px-3 py-2 border-b border-border/40">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${SOURCE_BADGE[r.source]}`}>
                        {r.source}
                      </span>
                    </td>
                    <td className="px-3 py-2 border-b border-border/40">
                      {HAS_FICHE[r.source] ? (
                        <button
                          onClick={() => navigate(`/support/poste/${encodeURIComponent(r.source)}/${r.id}`)}
                          className="font-mono font-semibold text-primary hover:underline underline-offset-2"
                        >
                          {r.asset}
                        </button>
                      ) : (
                        <button
                          onClick={() => navigate('/imprimantes-siege')}
                          className="font-mono font-semibold text-primary hover:underline underline-offset-2"
                        >
                          {r.asset}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2 border-b border-border/40 font-mono text-xs text-muted-foreground">
                      {r.sn ?? <Empty />}
                    </td>
                    <td className="px-3 py-2 border-b border-border/40">{r.type}</td>
                    <td className="px-3 py-2 border-b border-border/40">
                      {r.nom ?? <Empty />}
                    </td>
                    <td className="px-3 py-2 border-b border-border/40 font-mono text-xs text-muted-foreground">
                      {r.uid ?? <Empty />}
                    </td>
                    <td className="px-3 py-2 border-b border-border/40">
                      {r.agence ?? r.service ?? <Empty />}
                    </td>
                    <td className="px-3 py-2 border-b border-border/40 text-xs text-muted-foreground">
                      {r.windows_version ?? <Empty />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Aucun résultat */}
        {query && !isFetching && results.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 py-12 text-center text-sm text-muted-foreground">
            Aucun résultat pour «&nbsp;{query}&nbsp;»
          </div>
        )}

        {/* Invite initiale */}
        {!query && (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 py-12 text-center text-sm text-muted-foreground">
            Saisissez au moins 2 caractères pour lancer la recherche dans tous les inventaires
          </div>
        )}
      </section>

      <TicketsByOwner />
    </div>
  );
}
