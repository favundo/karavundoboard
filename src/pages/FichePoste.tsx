import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SOURCE_BADGE: Record<string, string> = {
  'Siège':       'bg-blue-100 text-blue-800',
  'ABcroisière': 'bg-purple-100 text-purple-800',
  'Agences':     'bg-emerald-100 text-emerald-800',
  'Stock':       'bg-orange-100 text-orange-800',
};

export default function FichePoste() {
  const { source, id } = useParams<{ source: string; id: string }>();
  const navigate = useNavigate();
  const decodedSource = source ? decodeURIComponent(source) : '';

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
      </div>

      {/* Contenu — à définir */}
      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-12 text-center text-muted-foreground">
        Contenu de la fiche — à définir
      </div>
    </div>
  );
}
