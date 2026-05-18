import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, ChevronLeft, ChevronRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'] as const;

const TECH_COLORS: Record<string, string> = {
  Abdelrahim: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
  Zahra:      'bg-pink-100   text-pink-800   dark:bg-pink-900/40   dark:text-pink-200',
  Mahran:     'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  Christy:    'bg-sky-100    text-sky-800    dark:bg-sky-900/40    dark:text-sky-200',
  Rémy:       'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
};

interface DayCell      { value: string; tt: boolean }
interface TechSchedule { name: string; schedule: DayCell[] }
interface WeekPlan     { weekNumber: number; dates: string[]; technicians: TechSchedule[] }
interface MonthPlan    { month: string; weeks: WeekPlan[] }

// Convert Excel "w" formatted string "M/D/YY" → "DD/MM"
function wToDateStr(w: string): string {
  const parts = w.split('/');
  if (parts.length !== 3) return w;
  return `${parts[1].padStart(2, '0')}/${parts[0].padStart(2, '0')}`;
}

function parseSheet(wb: XLSX.WorkBook, sheetName: string): WeekPlan[] {
  const ws = wb.Sheets[sheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const weeks: WeekPlan[] = [];
  let i = 0;

  while (i < rows.length) {
    const row = rows[i];
    if (row[0] === 'Semaine' && typeof row[1] === 'number') {
      const weekNumber = row[1];

      // Row i+2 = date serials — use the `w` (formatted) cell property for exact date strings
      const dates: string[] = [];
      for (let c = 1; c <= 7; c++) {
        const addr = XLSX.utils.encode_cell({ r: i + 2, c });
        const cell = ws[addr];
        dates.push(cell?.w ? wToDateStr(cell.w) : '');
      }

      // Technician rows start at i+3 until empty row or next "Semaine"
      const technicians: TechSchedule[] = [];
      let j = i + 3;
      while (j < rows.length && rows[j][0] !== '' && rows[j][0] !== 'Semaine') {
        const techRow = rows[j];
        if (techRow[0]) {
          technicians.push({
            name: String(techRow[0]),
            schedule: Array.from({ length: 7 }, (_, k) => {
              const addr = XLSX.utils.encode_cell({ r: j, c: k + 1 });
              const cell = ws[addr];
              return {
                value: String(techRow[k + 1] ?? ''),
                tt: cell?.s?.patternType === 'solid',
              };
            }),
          });
        }
        j++;
      }

      weeks.push({ weekNumber, dates, technicians });
      i = j + 1;
    } else {
      i++;
    }
  }

  return weeks;
}

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

function formatMonth(sheetName: string): string {
  const [year, month] = sheetName.split('-');
  const m = parseInt(month, 10) - 1;
  return `${MONTHS_FR[m] ?? month} ${year}`;
}

function cellClass(value: string, tt: boolean): string {
  if (!value.trim()) return '';
  const v = value.toLowerCase().trim();
  if (v === 'off') return 'bg-red-500 text-white font-semibold';
  if (v.startsWith('recup') || v.startsWith('récup'))
    return 'bg-amber-400 text-amber-950 font-medium';
  if (v.includes('h'))
    return tt
      ? 'bg-blue-600 text-white font-medium'      // Télétravail
      : 'bg-emerald-500 text-white font-medium';  // Présentiel / Bureau
  return 'bg-muted/40 text-muted-foreground';
}

const LEGEND = [
  { color: 'bg-emerald-500', label: 'Présentiel (bureau)' },
  { color: 'bg-blue-600',    label: 'Télétravail' },
  { color: 'bg-red-500',     label: 'Absence (OFF)' },
  { color: 'bg-amber-400',   label: 'Récupération' },
  { color: 'bg-muted/40 border border-border', label: 'Non planifié' },
];

const STORAGE_KEY = 'support-planning-tsi-v1';

export default function SupportPlanningTSI() {
  const [plan, setPlan] = useState<MonthPlan | null>(null);
  const [weekIdx, setWeekIdx] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  // Restore from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setPlan(JSON.parse(saved)); } catch {}
    }
  }, []);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array', cellStyles: true });
    const sheetName = wb.SheetNames[0];
    const weeks = parseSheet(wb, sheetName);
    const newPlan = { month: sheetName, weeks };
    setPlan(newPlan);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newPlan));
    setWeekIdx(0);
    e.target.value = '';
  }, []);

  const openPicker = () => fileRef.current?.click();

  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border bg-muted/20 p-16 text-center">
        <Upload className="h-8 w-8 text-muted-foreground" />
        <div>
          <p className="font-medium text-foreground">Importer le planning TSI</p>
          <p className="text-sm text-muted-foreground mt-1">
            Fichier Excel (.xlsx) au format du planning mensuel
          </p>
        </div>
        <Button variant="outline" onClick={openPicker}>Choisir un fichier</Button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
      </div>
    );
  }

  const week = plan.weeks[weekIdx];

  return (
    <div className="space-y-4">
      {/* Titre du mois */}
      <h2 className="text-xl font-bold text-foreground">{formatMonth(plan.month)}</h2>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">

          {/* Prev / label / Next */}
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={weekIdx === 0}
              onClick={() => setWeekIdx(i => i - 1)}>
              <ChevronLeft size={16} />
            </Button>
            <span className="px-2 text-sm font-semibold min-w-[90px] text-center">
              Semaine {week.weekNumber}
            </span>
            <Button variant="outline" size="sm" disabled={weekIdx === plan.weeks.length - 1}
              onClick={() => setWeekIdx(i => i + 1)}>
              <ChevronRight size={16} />
            </Button>
          </div>

          {/* Week chips */}
          <div className="flex gap-1">
            {plan.weeks.map((w, i) => (
              <button
                key={w.weekNumber}
                onClick={() => setWeekIdx(i)}
                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  i === weekIdx
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                S{w.weekNumber}
              </button>
            ))}
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={openPicker}>
          <Upload size={14} className="mr-1.5" />
          Mettre à jour
        </Button>
      </div>

      {/* Input unique partagé */}
      <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />

      {/* Légende */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Légende :</span>
        {LEGEND.map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`inline-block h-3.5 w-5 rounded ${color}`} />
            <span className="text-foreground">{label}</span>
          </span>
        ))}
      </div>

      {/* Planning grid */}
      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left px-4 py-2.5 font-semibold border-b border-border w-36">
                Technicien
              </th>
              {DAYS.map((day, i) => (
                <th key={day}
                  className="px-2 py-2.5 text-center border-b border-l border-border min-w-[120px]">
                  <div className="font-medium text-foreground">{day}</div>
                  {week.dates[i] && (
                    <div className="text-xs text-muted-foreground font-normal">{week.dates[i]}</div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {week.technicians.map((tech, ti) => (
              <tr key={tech.name} className={ti % 2 === 1 ? 'bg-muted/10' : ''}>
                <td className="px-4 py-3 border-r border-border">
                  <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold
                    ${TECH_COLORS[tech.name] ?? 'bg-muted text-foreground'}`}>
                    {tech.name}
                  </span>
                </td>
                {DAYS.map((_, di) => {
                  const cell = tech.schedule[di] ?? { value: '', tt: false };
                  const cls = cellClass(cell.value, cell.tt);
                  return (
                    <td key={di} className="px-2 py-2 border-l border-border text-center">
                      {cell.value ? (
                        <span className={`inline-block rounded px-2 py-1 text-xs whitespace-pre-wrap leading-tight ${cls}`}>
                          {cell.value}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/25 text-xs select-none">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
