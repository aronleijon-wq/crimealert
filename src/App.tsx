import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/hooks/useTheme";
import { AuthProvider } from "@/hooks/useAuth";
import CookieConsent from "@/components/CookieConsent";
import AdsController from "@/components/AdsController";
import BackendStatusBanner from "@/components/BackendStatusBanner";
import { lazy, Suspense } from "react";
import Landing from "./pages/Landing";
const Index = lazy(() => import("./pages/Index"));

// Lazy load non-critical routes for better initial load
const Analysis = lazy(() => import("./pages/Analysis"));
const Alerts = lazy(() => import("./pages/Alerts"));
const Account = lazy(() => import("./pages/Account"));
const Auth = lazy(() => import("./pages/Auth"));
const Cookies = lazy(() => import("./pages/Cookies"));
const Sekretesspolicy = lazy(() => import("./pages/Sekretesspolicy"));
const Villkor = lazy(() => import("./pages/Villkor"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Admin = lazy(() => import("./pages/Admin"));
const DebugPush = lazy(() => import("./pages/DebugPush"));
const OmOss = lazy(() => import("./pages/OmOss"));
const Feed = lazy(() => import("./pages/Feed"));
const Kommun = lazy(() => import("./pages/Kommun"));
const Kommuner = lazy(() => import("./pages/Kommuner"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const LazyFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => (
  <ThemeProvider>
  <AuthProvider>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<LazyFallback />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/karta" element={<Index />} />
          <Route path="/flode" element={<Feed />} />
          <Route path="/kommun" element={<Kommuner />} />
          <Route path="/kommun/:slug" element={<Kommun />} />
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
          <Route path="/om-oss" element={<OmOss />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        <CookieConsent />
        <BackendStatusBanner />
        <AdsController />

      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </AuthProvider>
  </ThemeProvider>
);

export default App;
