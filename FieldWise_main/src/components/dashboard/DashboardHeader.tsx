import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { 
  Tractor, 
  Leaf,
  User, 
  Settings, 
  Bell,
  Menu,
  Sparkles,
  CloudSun,
  Sprout,
  CheckCircle2,
  CheckCheck,
  Trash2,
  ArrowRight,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { notificationService, NOTIFICATION_EVENT, AppNotification } from "@/services/notificationService";

interface DashboardHeaderProps {
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
  onNavigateModule?: (module: string) => void;
  currentUser?: any;
}

function formatRelativeTime(dateString: string) {
  try {
    const diff = (Date.now() - new Date(dateString).getTime()) / 1000;
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return "Recently";
  }
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'welcome':
      return <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
    case 'alert':
      return <CloudSun className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
    case 'advisory':
      return <Sprout className="h-4 w-4 text-teal-600 dark:text-teal-400" />;
    case 'system':
    default:
      return <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
  }
}

const DashboardHeader = ({ 
  onToggleSidebar, 
  sidebarCollapsed, 
  onNavigateModule,
  currentUser
}: DashboardHeaderProps) => {
  const { user: authUser, logout } = useAuth();
  const navigate = useNavigate();

  // Resolve active logged in user
  const effectiveUser = currentUser || authUser || (() => {
    try {
      const stored = localStorage.getItem('smartfarm_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  })();

  const userId = effectiveUser?.id || effectiveUser?.email || 'default_user';

  const [notificationList, setNotificationList] = useState<AppNotification[]>([]);

  const loadNotifications = useCallback(() => {
    if (effectiveUser) {
      const notifs = notificationService.ensureUserNotifications(effectiveUser);
      setNotificationList(notifs);
    } else {
      setNotificationList([]);
    }
  }, [effectiveUser]);

  useEffect(() => {
    loadNotifications();

    const handleUpdate = () => {
      loadNotifications();
    };

    window.addEventListener(NOTIFICATION_EVENT, handleUpdate);
    return () => window.removeEventListener(NOTIFICATION_EVENT, handleUpdate);
  }, [loadNotifications]);

  const unreadCount = notificationList.filter((n) => !n.read).length;

  const handleMarkAsRead = (id: string) => {
    notificationService.markAsRead(userId, id);
  };

  const handleMarkAllAsRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    notificationService.markAllAsRead(userId);
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    notificationService.clearAll(userId);
  };

  const handleNotificationClick = (notif: AppNotification) => {
    handleMarkAsRead(notif.id);
    if (notif.actionModule) {
      if (onNavigateModule) {
        onNavigateModule(notif.actionModule);
      } else {
        navigate(`/${notif.actionModule}`);
      }
    }
  };
  
  // Get today's date
  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <header className="bg-card border-b border-border px-4 py-3 h-16 flex items-center justify-between sticky top-0 z-40">
      {/* Left section */}
      <div className="flex items-center space-x-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleSidebar}
          className="lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>
        
        {/* Logo and brand */}
        <div className="flex items-center space-x-3">
          <div 
            className="flex items-center space-x-2.5 cursor-pointer group"
            onClick={() => onNavigateModule && onNavigateModule("home")}
            title="Crops Wild — Farm Intelligence Platform"
          >
            <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-xs">
              <Leaf className="h-4 w-4 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-foreground leading-none tracking-tight">Crops Wild</h1>
              <p className="text-[11px] text-muted-foreground leading-none mt-1">Farm Intelligence Platform</p>
            </div>
          </div>
        </div>
      </div>

      {/* Center section - Date */}
      <div className="hidden md:flex items-center">
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Today</p>
          <p className="text-xs text-muted-foreground">{formattedDate}</p>
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        {/* Real Interactive Notifications Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="relative hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-foreground transition-colors"
              title={`${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`}
            >
              <Bell className="h-5 w-5 text-gray-700 dark:text-gray-200" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shadow-xs animate-in zoom-in">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            className="w-80 sm:w-96 p-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl z-50 overflow-hidden" 
            align="end"
          >
            {/* Header */}
            <div className="p-3.5 bg-gray-50/80 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-gray-900 dark:text-white">Notifications</span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline flex items-center gap-1"
                    title="Mark all as read"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    <span>Read all</span>
                  </button>
                )}
                {notificationList.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="text-[11px] font-medium text-gray-400 hover:text-rose-500 flex items-center gap-1 ml-2 transition-colors"
                    title="Clear all notifications"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Notification items list */}
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
              {notificationList.length === 0 ? (
                <div className="py-8 px-4 text-center">
                  <div className="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-2">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">All caught up!</p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                    Real-time crop, weather, and farm advisories will appear here.
                  </p>
                </div>
              ) : (
                notificationList.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer flex gap-3 ${
                      !notif.read ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : ''
                    }`}
                  >
                    <div className="h-8 w-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 mt-0.5 border border-gray-200/60 dark:border-gray-700/60">
                      {getNotificationIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p className={`text-xs font-bold truncate ${!notif.read ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                          {notif.title}
                        </p>
                        {!notif.read && (
                          <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-2">
                        {notif.message}
                      </p>
                      <div className="flex items-center justify-between mt-2 pt-1 border-t border-gray-100/60 dark:border-gray-800/60">
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                          {formatRelativeTime(notif.createdAt)}
                        </span>
                        {notif.actionLabel && (
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 hover:underline">
                            {notif.actionLabel}
                            <ArrowRight className="h-2.5 w-2.5" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-2.5 bg-gray-50 dark:bg-gray-800/40 border-t border-gray-100 dark:border-gray-800 text-center">
              <button
                onClick={() => onNavigateModule && onNavigateModule("expert-consultation")}
                className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center justify-center gap-1 w-full"
              >
                <span>Need expert guidance? Contact Support</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Profile dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center space-x-2 hover:bg-accent">
              <Avatar className="h-8 w-8">
                <AvatarImage src="/farmer-avatar.jpg" alt="Farmer" />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium">{effectiveUser?.name || effectiveUser?.full_name || effectiveUser?.username || "Farmer"}</p>
                <p className="text-xs text-muted-foreground">Active Farmer</p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 bg-card" align="end">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onNavigateModule ? onNavigateModule("profile") : navigate("/profile")}>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onNavigateModule ? onNavigateModule("settings") : navigate("/settings")}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={logout}
              className="text-red-600 dark:text-red-400 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/40 font-medium cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default DashboardHeader;