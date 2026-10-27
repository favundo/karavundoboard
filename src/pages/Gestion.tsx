import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LogoutButton } from "@/components/LogoutButton";
import TechniciansManager from "@/components/gestion/TechniciansManager";

const Gestion = () => (
  <div className="min-h-screen bg-background flex flex-col">
    <header className="border-b border-border px-6 py-3 flex justify-end">
      <ThemeToggle />
      <LogoutButton />
    </header>
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-bold text-foreground mb-6">Gestion du site</h1>
      <TechniciansManager />
    </main>
  </div>
);

export default Gestion;
