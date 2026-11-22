import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  User,
  Sprout,
  FlaskConical,
  ScanEye,
  Activity,
  CloudSun,
  Layers,
  TrendingUp,
  Landmark,
  Headphones,
  Settings,
  HelpCircle,
  BookOpen,
  Leaf,
  X,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

interface DashboardSidebarProps {
  activeModule: string;
  setActiveModule: (module: string) => void;
  isCollapsed: boolean;
  onToggle: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  aliases: string[];
  comingSoon?: boolean;
}

interface NavGroup {
  heading?: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    items: [
      {
        id: "home",
        label: "Dashboard",
        icon: LayoutDashboard,
        aliases: ["home"],
      },
      {
        id: "profile",
        label: "My Farm",
        icon: User,
        aliases: ["profile", "farmer-profile"],
      },
    ],
  },
  {
    heading: "AI Intelligence",
    items: [
      {
        id: "crop-recommendation",
        label: "Crop Recommendation",
        icon: Sprout,
        aliases: ["crop-recommendation", "crop-profit-predictor"],
      },
      {
        id: "fertilizer-recommendation",
        label: "Fertilizer Recommendation",
        icon: FlaskConical,
        aliases: ["fertilizer-recommendation"],
      },
      {
        id: "disease-detection",
        label: "Disease Detection",
        icon: ScanEye,
        aliases: ["disease-detection"],
      },
      {
        id: "farm-intelligence",
        label: "Farm Intelligence",
        icon: Activity,
        aliases: ["farm-intelligence", "farm-analysis"],
      },
    ],
  },
  {
    heading: "Farm Data",
    items: [
      {
        id: "weather",
        label: "Weather",
        icon: CloudSun,
        aliases: ["weather", "weather-alerts", "market-supply-tracker"],
      },
      {
        id: "soil-environment",
        label: "Soil & Environment",
        icon: Layers,
        aliases: ["soil-environment", "soil-intelligence", "soil-analysis"],
      },
      {
        id: "mandi",
        label: "Mandi Prices",
        icon: TrendingUp,
        aliases: ["mandi", "farmer-market", "marketplace"],
      },
    ],
  },
  {
    heading: "Farmer Support",
    items: [
      {
        id: "government-schemes",
        label: "Government Schemes",
        icon: Landmark,
        aliases: ["government-schemes"],
      },
      {
        id: "expert-consultation",
        label: "Expert Support",
        icon: Headphones,
        aliases: ["expert-consultation", "expert-support"],
      },
    ],
  },
];

const bottomItems: NavItem[] = [
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    aliases: ["settings"],
  },
  {
    id: "help",
    label: "Help",
    icon: HelpCircle,
    aliases: ["help"],
  },
  {
    id: "documentation",
    label: "Docs",
    icon: BookOpen,
    aliases: ["documentation", "docs"],
  },
];

const isActive = (item: NavItem, activeModule: string) =>
  item.aliases.includes(activeModule);

const DashboardSidebar = ({
  activeModule,
  setActiveModule,
  isCollapsed,
  onToggle,
}: DashboardSidebarProps) => {
  const { user, logout } = useAuth();

  const navigate = (id: string) => {
    setActiveModule(id);
    if (window.innerWidth < 1024) {
      onToggle();
    }
  };

  return (
    <>
      {/* Mobile backdrop */}
      {!isCollapsed && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        style={{
          backgroundColor: '#0a2316',
          backgroundImage: 'radial-gradient(rgba(52, 211, 153, 0.12) 1.2px, transparent 1.2px)',
          backgroundSize: '20px 20px',
        }}
        className={cn(
          "fixed left-0 top-16 h-[calc(100vh-4rem)] border-r border-[#153a23] z-50 flex flex-col transition-all duration-300 text-white shadow-xl",
          "lg:translate-x-0",
          isCollapsed
            ? "-translate-x-full lg:w-[64px]"
            : "translate-x-0 w-[240px] lg:w-[240px]"
        )}
      >
        {/* Brand bar (mobile close button) */}
        <div
          className={cn(
            "flex items-center border-b border-[#153a23] shrink-0 bg-[#071a10]/60",
            isCollapsed ? "justify-center px-0 py-3" : "justify-between px-4 py-3"
          )}
        >
          {!isCollapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-7 w-7 rounded-lg bg-emerald-600 border border-emerald-400/40 flex items-center justify-center shrink-0 shadow-xs">
                <Leaf className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white leading-none">
                  Crops Wild
                </p>
                <p className="text-[10px] text-emerald-300/80 leading-none mt-0.5 font-medium">
                  Farm Intelligence
                </p>
              </div>
            </div>
          )}
          {isCollapsed && (
            <div className="h-7 w-7 rounded-lg bg-emerald-600 border border-emerald-400/40 flex items-center justify-center shadow-xs">
              <Leaf className="h-4 w-4 text-white" />
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="lg:hidden h-7 w-7 text-emerald-300/80 hover:text-white hover:bg-white/10 shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Main navigation — scrollable */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
          {navGroups.map((group, gi) => (
            <div key={gi} className={cn(gi > 0 && "mt-4")}>
              {/* Group heading */}
              {group.heading && !isCollapsed && (
                <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300/70">
                  {group.heading}
                </p>
              )}
              {group.heading && isCollapsed && (
                <div className="my-2 mx-auto w-6 border-t border-[#153a23]" />
              )}

              {/* Items */}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item, activeModule);
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.id}
                      onClick={() => !item.comingSoon && navigate(item.id)}
                      title={item.label}
                      className={cn(
                        "w-full flex items-center gap-2.5 rounded-lg text-sm transition-all duration-150",
                        isCollapsed
                          ? "justify-center px-0 py-2.5"
                          : "px-2.5 py-2",
                        active
                          ? "bg-emerald-500/25 text-white font-semibold border border-emerald-400/60 shadow-xs"
                          : item.comingSoon
                          ? "text-emerald-100/30 cursor-default"
                          : "text-emerald-100/80 hover:bg-white/10 hover:text-white"
                      )}
                      disabled={item.comingSoon}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          active
                            ? "text-emerald-300"
                            : item.comingSoon
                            ? "text-emerald-100/30"
                            : "text-emerald-200/70"
                        )}
                      />
                      {!isCollapsed && (
                        <span className="truncate flex-1 text-left text-[13px]">
                          {item.label}
                        </span>
                      )}
                      {!isCollapsed && item.comingSoon && (
                        <span className="text-[9px] font-medium text-emerald-300/70 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 shrink-0">
                          Soon
                        </span>
                      )}
                      {!isCollapsed && active && !item.comingSoon && (
                        <ChevronRight className="h-3 w-3 text-emerald-300 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="shrink-0 border-t border-[#153a23] px-2 py-2 space-y-0.5 bg-[#071a10]/40">
          {bottomItems.map((item) => {
            const active = isActive(item, activeModule);
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                title={item.label}
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-lg text-[13px] transition-colors duration-150",
                  isCollapsed
                    ? "justify-center px-0 py-2.5"
                    : "px-2.5 py-2",
                  active
                    ? "bg-emerald-500/25 text-white font-semibold border border-emerald-400/60 shadow-xs"
                    : "text-emerald-100/80 hover:bg-white/10 hover:text-white"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    active
                      ? "text-emerald-300"
                      : "text-emerald-200/70"
                  )}
                />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}

        </div>

        {/* User footer */}
        {!isCollapsed && user && (
          <div className="shrink-0 border-t border-[#153a23] bg-[#071a10]/60">
            <div className="px-3 py-2.5 flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-full bg-emerald-700/80 border border-emerald-400/40 flex items-center justify-center shrink-0">
                <span className="text-[11px] font-bold text-white uppercase">
                  {(user.full_name || user.username || "F").charAt(0)}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">
                  {user.full_name || user.username}
                </p>
                {user.location && (
                  <p className="text-[10px] text-emerald-300/80 truncate">
                    {user.location}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={logout}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-red-400 hover:bg-white/10 hover:text-red-300 transition-colors duration-150 border-t border-[#153a23]"
              title="Logout"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>Logout</span>
            </button>
          </div>
        )}
        {isCollapsed && user && (
          <div className="shrink-0 border-t border-[#153a23] bg-[#071a10]/60">
            <div className="py-2.5 flex justify-center">
              <div className="h-7 w-7 rounded-full bg-emerald-700/80 border border-emerald-400/40 flex items-center justify-center">
                <span className="text-[11px] font-bold text-white uppercase">
                  {(user.full_name || user.username || "F").charAt(0)}
                </span>
              </div>
            </div>
            <button
              onClick={logout}
              className="w-full flex justify-center py-2 text-red-400 hover:bg-white/10 hover:text-red-300 transition-colors duration-150 border-t border-[#153a23]"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </aside>
    </>
  );
};

export default DashboardSidebar;