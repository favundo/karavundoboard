import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Agency from "./pages/Agency";
import Abcroisiere from "./pages/Abcroisiere";
import Stock from "./pages/Stock";
import Support from "./pages/Support";
import Gestion from "./pages/Gestion";
import NotFound from "./pages/NotFound";
import SupportDashboard from "./components/support/SupportDashboard";
import SupportCalendar from "./components/support/SupportCalendar";
import SupportPlanningTSI from "./components/support/SupportPlanningTSI";
import FichePoste from "./pages/FichePoste";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/agences" element={<Agency />} />
          <Route path="/abcroisiere" element={<Abcroisiere />} />
          <Route path="/stock" element={<Stock />} />
          <Route path="/support" element={<Support />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<SupportDashboard />} />
            <Route path="planning" element={<SupportCalendar />} />
            <Route path="planning-tsi" element={<SupportPlanningTSI />} />
            <Route path="poste/:source/:id" element={<FichePoste />} />
          </Route>
          <Route path="/gestion" element={<Gestion />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
