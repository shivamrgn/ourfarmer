import { useState } from "react";
import DashboardHeader from "./dashboard/DashboardHeader";
import DashboardSidebar from "./dashboard/DashboardSidebar";
import DashboardMainContent from "./dashboard/DashboardMainContent";
import DashboardFooter from "./dashboard/DashboardFooter";
import CropRecommendation from "./modules/CropRecommendation";
import DiseaseDetection from "./modules/DiseaseDetection";
import Marketplace from "./modules/Marketplace";
import EquipmentRental from "./modules/EquipmentRental";
import FarmMarket from "./modules/FarmMarket";
import WeatherAlerts from "./modules/WeatherAlerts";
import GovernmentSchemes from "./modules/GovernmentSchemes";
import ExpertConsultation from "./modules/ExpertConsultation";
import AccuracyTest from "./modules/AccuracyTest";
import HelpPage from "./modules/HelpPage";
import FertilizerRecommendation from "./modules/FertilizerRecommendation";
import EnhancedMarketPrices from "./modules/EnhancedMarketPrices";
import MandiPriceIntelligence from "./modules/MandiPriceIntelligence";
import SoilEnvironmentIntelligence from "./modules/SoilEnvironmentIntelligence";
import FarmIntelligence from "./modules/FarmIntelligence";
import DocumentationPage from "./modules/DocumentationPage";
import ProfilePage from "@/pages/Profile";
import SettingsPage from "@/pages/Settings";
import { WeatherProvider } from "@/components/dashboard/WeatherContext";
import { useAuth } from "@/context/AuthContext";
import ErrorBoundary from "@/components/common/ErrorBoundary";

interface DashboardProps {
  user?: any;
  onLogout?: () => void;
}

export function Dashboard({ user: propUser }: DashboardProps) {
  const [activeModule, setActiveModule] = useState("home");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user: authUser } = useAuth();

  const currentUser = propUser || authUser;

  const renderModuleContent = () => {
    switch (activeModule) {
      case "profile":
      case "farmer-profile":
        return <ProfilePage onNavigate={setActiveModule} />;
      case "crop-recommendation":
      case "crop-profit-predictor":
        return <CropRecommendation onNavigate={setActiveModule} />;
      case "fertilizer-recommendation":
        return <FertilizerRecommendation onNavigate={setActiveModule} />;
      case "disease-detection":
        return <DiseaseDetection onNavigate={setActiveModule} />;
      case "weather":
      case "weather-alerts":
      case "market-supply-tracker":
        return <WeatherAlerts onNavigate={setActiveModule} />;
      case "soil-environment":
      case "soil-intelligence":
      case "soil-analysis":
        return <SoilEnvironmentIntelligence onNavigate={setActiveModule} />;
      case "mandi":
      case "farmer-market":
      case "mandi-prices":
        return <MandiPriceIntelligence onNavigate={setActiveModule} />;
      case "marketplace":
        return <Marketplace />;
      case "equipment-rental":
      case "rentals":
        return <EquipmentRental />;
      case "government-schemes":
      case "schemes":
        return <GovernmentSchemes onNavigate={setActiveModule} />;
      case "expert-support":
      case "expert-consultation":
        return <ExpertConsultation onNavigate={setActiveModule} />;
      case "accuracy-test":
        return <AccuracyTest />;
      case "settings":
        return <SettingsPage />;
      case "help":
        return <HelpPage onNavigate={setActiveModule} />;
      case "documentation":
      case "docs":
        return <DocumentationPage onNavigate={setActiveModule} />;
      case "farm-intelligence":
      case "farm-analysis":
        return <FarmIntelligence onNavigate={setActiveModule} />;
      case "home":
      default:
        return (
          <DashboardMainContent 
            activeModule={activeModule} 
            setActiveModule={setActiveModule} 
          />
        );
    }
  };

  return (
    <WeatherProvider>
      <div className="min-h-screen bg-background flex flex-col font-sans">
        {/* Header */}
        <DashboardHeader 
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
          sidebarCollapsed={sidebarCollapsed}
          onNavigateModule={setActiveModule}
          currentUser={currentUser}
        />

        <div className="flex flex-1 relative">
          {/* Sidebar */}
          <DashboardSidebar 
            activeModule={activeModule}
            setActiveModule={setActiveModule}
            isCollapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          />

          {/* Main Content Area */}
          <main className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
            sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-60'
          }`}>
            <div className="flex-1 overflow-auto">
              <ErrorBoundary
                key={activeModule}
                fallbackTitle="Unable to Display Module"
                onNavigateHome={() => setActiveModule("home")}
              >
                {renderModuleContent()}
              </ErrorBoundary>
            </div>
            
            {/* Footer */}
            <DashboardFooter onNavigateModule={setActiveModule} />
          </main>
        </div>
      </div>
    </WeatherProvider>
  );
}

export default Dashboard;
