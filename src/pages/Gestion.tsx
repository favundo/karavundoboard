import { ThemeToggle } from "@/components/ui/ThemeToggle";

const Gestion = () => (
  <div className="min-h-screen bg-background flex flex-col">
    <header className="border-b border-border px-6 py-3 flex justify-end">
      <ThemeToggle />
    </header>
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground mb-2">Gestion du site</h1>
        <p className="text-muted-foreground text-lg">Zone reservee aux gens serieux. Ou pas.</p>
        <p className="text-muted-foreground/60 mt-1 text-sm">(Les fonctionnalites arrivent, promis — on cherche juste ou on a mis les cles.)</p>
      </div>
    </div>
  </div>
);

export default Gestion;
