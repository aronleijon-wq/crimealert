import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/hooks/useTheme";
import { AuthProvider } from "@/hooks/useAuth";
import CookieConsent from "@/components/CookieConsent";
import Index from "./pages/Index";
import Analysis from "./pages/Analysis";
import Alerts from "./pages/Alerts";
import Account from "./pages/Account";
import Auth from "./pages/Auth";
import Cookies from "./pages/Cookies";
import Sekretesspolicy from "./pages/Sekretesspolicy";
import Villkor from "./pages/Villkor";
import ResetPassword from "./pages/ResetPassword";
import Admin from "./pages/Admin";
import DebugPush from "./pages/DebugPush";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider>
  <AuthProvider>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/account" element={<Account />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/cookies" element={<Cookies />} />
          <Route path="/sekretesspolicy" element={<Sekretesspolicy />} />
          <Route path="/privacy" element={<Sekretesspolicy />} />
          <Route path="/villkor" element={<Villkor />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/debug-push" element={<DebugPush />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <CookieConsent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </AuthProvider>
  </ThemeProvider>
);

export default App;
