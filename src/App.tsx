import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminAuthGuard } from "@/components/AdminAuthGuard";

import JoinCodeScreen from "./pages/participant/JoinCodeScreen";
import JoinScreen from "./pages/participant/JoinScreen";
import LobbyScreen from "./pages/participant/LobbyScreen";
import VoteScreen from "./pages/participant/VoteScreen";
import ResultsScreen from "./pages/participant/ResultsScreen";
import AdminPasswordGate from "./pages/admin/AdminPasswordGate";
import AdminSessionsScreen from "./pages/admin/AdminSessionsScreen";
import AdminNewSessionScreen from "./pages/admin/AdminNewSessionScreen";
import AdminSetupScreen from "./pages/admin/AdminSetupScreen";
import AdminLobbyScreen from "./pages/admin/AdminLobbyScreen";
import AdminPitchScreen from "./pages/admin/AdminPitchScreen";
import AdminResultsScreen from "./pages/admin/AdminResultsScreen";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Participant routes */}
          <Route path="/" element={<JoinCodeScreen />} />
          <Route path="/join/:code" element={<JoinScreen />} />
          <Route path="/lobby" element={<LobbyScreen />} />
          <Route path="/vote" element={<VoteScreen />} />
          <Route path="/results" element={<ResultsScreen />} />

          {/* Admin routes */}
          <Route path="/admin" element={<AdminPasswordGate />} />
          <Route path="/admin/sessions" element={<AdminAuthGuard><AdminSessionsScreen /></AdminAuthGuard>} />
          <Route path="/admin/sessions/new" element={<AdminAuthGuard><AdminNewSessionScreen /></AdminAuthGuard>} />
          <Route path="/admin/sessions/:id/setup" element={<AdminAuthGuard><AdminSetupScreen /></AdminAuthGuard>} />
          <Route path="/admin/sessions/:id/lobby" element={<AdminAuthGuard><AdminLobbyScreen /></AdminAuthGuard>} />
          <Route path="/admin/sessions/:id/pitch" element={<AdminAuthGuard><AdminPitchScreen /></AdminAuthGuard>} />
          <Route path="/admin/sessions/:id/results" element={<AdminAuthGuard><AdminResultsScreen /></AdminAuthGuard>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
