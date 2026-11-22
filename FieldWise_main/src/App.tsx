import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import { AuthProvider } from "@/context/AuthContext";
import { WeatherProvider } from "@/components/dashboard/WeatherContext";
import { LocationProvider } from "@/context/LocationContext";
import ProfilePage from "./pages/Profile";
import SettingsPage from "./pages/Settings";
import TermsAndConditions from "./pages/TermsAndConditions";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import ExpertConsultation from "./components/modules/ExpertConsultation";
import AccuracyTest from "./components/modules/AccuracyTest";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <WeatherProvider>
        <LocationProvider>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/expert-consultation" element={<ExpertConsultation />} />
                <Route path="/accuracy-test" element={<AccuracyTest />} />
                <Route path="/terms" element={<TermsAndConditions />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </LocationProvider>
      </WeatherProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
