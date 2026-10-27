import { useState } from 'react';
import { toast } from 'sonner';
import { Archive, RotateCcw, UserPlus, Users } from 'lucide-react';
import { useAllTechnicians, type Technician } from '@/lib/technicians';
import { useIsAdmin } from '@/components/AdminOnly';
import { useArchiveTechnician, useCreateTechnician } from '@/hooks/useTechnicianMutations';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const inputCls =
  'h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30';
const labelCls = 'mb-1 block text-xs font-medium text-muted-foreground';

const EMPTY = { id: '', label: '', email: '', firstName: '', axialys: '', bgColor: '#64748b', monthlyReport: true };

function TechRow({ t, isAdmin, onArchive, onRestore }: {
  t: Technician; isAdmin: boolean; onArchive: () => void; onRestore: () => void;
}) {
  const archived = t.active === false;
  return (
    <tr className={`border-t border-border ${archived ? 'opacity-50' : ''}`}>
      <td className="px-3 py-2">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: t.bgColor }} />
          <span className="font-medium text-foreground">{t.label}</span>
        </span>
      </td>
      <td className="px-3 py-2 font-mono text-xs">{t.id}</td>
      <td className="px-3 py-2 text-xs">{t.email}</td>
      <td className="px-3 py-2 text-xs">{t.axialys ?? <span className="text-muted-foreground/50">—</span>}</td>
      <td className="px-3 py-2 text-xs">{t.monthlyReport ? 'Oui' : 'Non'}</td>
      <td className="px-3 py-2 text-right">
        {isAdmin && (archived ? (
          <button onClick={onRestore} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
            <RotateCcw size={12} /> Réactiver
          </button>
        ) : (
          <button onClick={onArchive} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-500/10 dark:text-red-400">
            <Archive size={12} /> Supprimer
          </button>
        ))}
      </td>
    </tr>
  );
}

export default function TechniciansManager() {
  const technicians = useAllTechnicians();
  const isAdmin = useIsAdmin();
  const create = useCreateTechnician();
  const archive = useArchiveTechnician();
  const [form, setForm] = useState(EMPTY);
  const [toArchive, setToArchive] = useState<Technician | null>(null);

  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate(
      { ...form, email: form.email || `${form.id}@karavel.com` },
      {
        onSuccess: (t) => { toast.success(`${t.label} ajouté`); setForm(EMPTY); },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  const restore = (t: Technician) =>
    create.mutate(t, {
      onSuccess: () => toast.success(`${t.label} réactivé`),
      onError: (err) => toast.error(err.message),
    });

  const confirmArchive = () => {
    if (!toArchive) return;
    archive.mutate(toArchive.id, {
      onSuccess: (t) => toast.success(`${t.label} supprimé`),
      onError: (err) => toast.error(err.message),
    });
    setToArchive(null);
  };

  // Actifs d'abord, archivés en fin de liste.
  const sorted = [...technicians].sort((a, b) => Number(a.active === false) - Number(b.active === false));

  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm">
      <header className="flex items-center gap-3 border-b border-border px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Users size={16} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Techniciens du support</h2>
          <p className="text-xs text-muted-foreground">
            Planning, arrivées, stats RT et rapport mensuel. L'identifiant est le login AD.
          </p>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-muted-foreground">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground/70">
              <th className="px-3 py-2 font-medium">Nom</th>
              <th className="px-3 py-2 font-medium">Login AD</th>
              <th className="px-3 py-2 font-medium">Mail</th>
              <th className="px-3 py-2 font-medium">Nom Axialys</th>
              <th className="px-3 py-2 font-medium">Rapport mensuel</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => (
              <TechRow key={t.id} t={t} isAdmin={isAdmin} onArchive={() => setToArchive(t)} onRestore={() => restore(t)} />
            ))}
          </tbody>
        </table>
      </div>

      {isAdmin ? (
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 border-t border-border px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={labelCls}>Login AD *</label>
            <input required value={form.id} onChange={(e) => set('id', e.target.value.trim().toLowerCase())} placeholder="jdupont" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Nom affiché *</label>
            <input required value={form.label} onChange={(e) => set('label', e.target.value)} placeholder="J. Dupont" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Prénom (mails)</label>
            <input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} placeholder="Jean" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Mail</label>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder={form.id ? `${form.id}@karavel.com` : 'jdupont@karavel.com'} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Nom Axialys</label>
            <input value={form.axialys} onChange={(e) => set('axialys', e.target.value)} placeholder="Prénom dans « Prénom TSI »" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Couleur</label>
            <input type="color" value={form.bgColor} onChange={(e) => set('bgColor', e.target.value)} className="h-9 w-16 cursor-pointer rounded-lg border border-border bg-background" />
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-foreground">
            <input type="checkbox" checked={form.monthlyReport} onChange={(e) => set('monthlyReport', e.target.checked)} />
            Reçoit le rapport mensuel
          </label>
          <div className="flex items-end justify-end">
            <button type="submit" disabled={create.isPending} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
              <UserPlus size={14} /> Ajouter
            </button>
          </div>
        </form>
      ) : (
        <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
          L'ajout et la suppression sont réservés au groupe <span className="font-mono">karinventaire-admin</span>.
        </p>
      )}

      <AlertDialog open={!!toArchive} onOpenChange={(o) => !o && setToArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {toArchive?.label} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Il disparaîtra des listes de choix et du rapport mensuel. Ses rendez-vous et ses
              statistiques passés sont conservés, et il peut être réactivé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmArchive}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
