import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { ThemeProvider } from "@/hooks/useTheme";
import { AuthProvider } from "@/hooks/useAuth";
import AdsController from "@/components/AdsController";
import BackendStatusBanner from "@/components/BackendStatusBanner";
import { Suspense, useEffect } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { trackPageView } from "@/lib/monitoring";
import { lazyPage } from "@/lib/staleBuild";
import Landing from "./pages/Landing";
const Index = lazyPage(() => import("./pages/Index"));

// Lazy load non-critical routes for better initial load
const Analysis = lazyPage(() => import("./pages/Analysis"));
const Alerts = lazyPage(() => import("./pages/Alerts"));
const Prisplan = lazyPage(() => import("./pages/Prisplan"));
const Installningar = lazyPage(() => import("./pages/Installningar"));
const Auth = lazyPage(() => import("./pages/Auth"));
const Cookies = lazyPage(() => import("./pages/Cookies"));
const Sekretesspolicy = lazyPage(() => import("./pages/Sekretesspolicy"));
const Villkor = lazyPage(() => import("./pages/Villkor"));
const ResetPassword = lazyPage(() => import("./pages/ResetPassword"));
const Admin = lazyPage(() => import("./pages/Admin"));
const DebugPush = lazyPage(() => import("./pages/DebugPush"));
const OmOss = lazyPage(() => import("./pages/OmOss"));
const Feed = lazyPage(() => import("./pages/Feed"));
const Kommun = lazyPage(() => import("./pages/Kommun"));
const Kommuner = lazyPage(() => import("./pages/Kommuner"));
const Handelse = lazyPage(() => import("./pages/Handelse"));
const NotFound = lazyPage(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

/** Counts page views as the visitor moves around the app. */
const PageViews = () => {
  const { pathname } = useLocation();
  useEffect(() => trackPageView(pathname), [pathname]);
  return null;
};

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
        <PageViews />
        <ErrorBoundary>
        <Suspense fallback={<LazyFallback />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/karta" element={<Index />} />
          <Route path="/flode" element={<Feed />} />
          <Route path="/kommun" element={<Kommuner />} />
          <Route path="/kommun/:slug" element={<Kommun />} />
          <Route path="/handelse/:id" element={<Handelse />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/prisplan" element={<Prisplan />} />
          {/* Stripe sends people back here after checkout (create-checkout), and older links point here */}
          <Route path="/account" element={<Prisplan />} />
          <Route path="/installningar" element={<Installningar />} />
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
        </ErrorBoundary>
        <BackendStatusBanner />
        <AdsController />

      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </AuthProvider>
  </ThemeProvider>
);

export default App;
