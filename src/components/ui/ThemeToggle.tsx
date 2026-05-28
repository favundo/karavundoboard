import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      title={theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background/50 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
