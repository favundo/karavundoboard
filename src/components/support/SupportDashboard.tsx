import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

type Source = 'Siège' | 'ABcroisière' | 'Agences' | 'Stock';

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

async function searchAllTables(query: string): Promise<SearchResult[]> {
  const q = `%${query}%`;
  const [siege, abc, agences, stock] = await Promise.all([
    supabase
      .from('inventory_items')
      .select('id,asset,sn,type,nom,uid,service,windows_version,eset_app')
      .or(`asset.ilike.${q},sn.ilike.${q},nom.ilike.${q},uid.ilike.${q}`)
      .limit(50),
    supabase
      .from('abcroisiere_inventory')
      .select('id,asset,sn,type,nom,uid,service,windows_version,eset_app')
      .or(`asset.ilike.${q},sn.ilike.${q},nom.ilike.${q},uid.ilike.${q}`)
      .limit(50),
    supabase
      .from('agency_inventory')
      .select('id,asset,sn,type,agence,os_version,eset_app')
      .or(`asset.ilike.${q},sn.ilike.${q},agence.ilike.${q}`)
      .limit(50),
    supabase
      .from('stock_inventory')
      .select('id,asset,sn,type,nom,uid,service,windows_version,eset_app')
      .or(`asset.ilike.${q},sn.ilike.${q},nom.ilike.${q},uid.ilike.${q}`)
      .limit(50),
  ]);

  return [
    ...(siege.data ?? []).map(r => ({ ...r, source: 'Siège' as Source, agence: null })),
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
  ];
}

const SOURCE_BADGE: Record<Source, string> = {
  'Siège':       'bg-blue-100 text-blue-800',
  'ABcroisière': 'bg-purple-100 text-purple-800',
  'Agences':     'bg-emerald-100 text-emerald-800',
  'Stock':       'bg-orange-100 text-orange-800',
};

const Empty = ({ text }: { text: string }) => (
  <span className="text-muted-foreground/40">—</span>
);

export default function SupportDashboard() {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
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

  return (
    <div className="space-y-4">
      {/* Barre de recherche */}
      <div className="relative max-w-2xl">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Rechercher par asset, N/S, collaborateur, UID, agence…"
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
          {results.length === 200 && ' — affinez la recherche pour voir plus'}
        </p>
      )}

      {/* Tableau */}
      {results.length > 0 && (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/50 text-left">
                {['Source', 'Asset', 'N/S', 'Type', 'Collaborateur', 'UID', 'Service / Agence', 'OS'].map(h => (
                  <th key={h} className="px-3 py-2.5 font-semibold border-b border-border whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={`${r.source}-${r.id}`}
                  className={`transition-colors hover:bg-muted/20 ${i % 2 === 1 ? 'bg-muted/10' : ''}`}>
                  <td className="px-3 py-2 border-b border-border/40">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${SOURCE_BADGE[r.source]}`}>
                      {r.source}
                    </span>
                  </td>
                  <td className="px-3 py-2 border-b border-border/40">
                    <button
                      onClick={() => navigate(`/support/poste/${encodeURIComponent(r.source)}/${r.id}`)}
                      className="font-mono font-semibold text-primary hover:underline underline-offset-2"
                    >
                      {r.asset}
                    </button>
                  </td>
                  <td className="px-3 py-2 border-b border-border/40 font-mono text-xs text-muted-foreground">
                    {r.sn ?? <Empty text="—" />}
                  </td>
                  <td className="px-3 py-2 border-b border-border/40">{r.type}</td>
                  <td className="px-3 py-2 border-b border-border/40">
                    {r.nom ?? <Empty text="—" />}
                  </td>
                  <td className="px-3 py-2 border-b border-border/40 font-mono text-xs text-muted-foreground">
                    {r.uid ?? <Empty text="—" />}
                  </td>
                  <td className="px-3 py-2 border-b border-border/40">
                    {r.agence ?? r.service ?? <Empty text="—" />}
                  </td>
                  <td className="px-3 py-2 border-b border-border/40 text-xs text-muted-foreground">
                    {r.windows_version ?? <Empty text="—" />}
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
    </div>
  );
}
