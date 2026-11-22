import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { farmProfileService } from "@/services/farmProfileService";
import { 
  Settings as SettingsIcon,
  User,
  Bell,
  Shield,
  Globe,
  Palette,
  Database,
  Download,
  Trash2,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  Compass
} from "lucide-react";

function splitFullName(name: string) {
  if (!name) return { firstName: "", lastName: "" };
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

const SettingsPage = () => {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();

  const farmProfile = farmProfileService.getFarmProfile(user);
  const initialName = splitFullName(user?.full_name || user?.username || farmProfile.farmer.fullName || "");
  const initialLocation = user?.location || (farmProfile.farmer.district && farmProfile.farmer.state ? `${farmProfile.farmer.district}, ${farmProfile.farmer.state}` : farmProfile.farmer.state || farmProfile.farmer.district || "");
  const initialSize = user?.farm_size ? String(user.farm_size).replace(/[^0-9.]/g, '') : (farmProfile.farm.farmSize ? String(farmProfile.farm.farmSize) : "");
  
  // General Settings
  const [language, setLanguage] = useState("en");
  const [notifications, setNotifications] = useState(true);
  const [theme, setTheme] = useState("system");
  const [region, setRegion] = useState("IN");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  
  // Privacy Settings
  const [privacyShare, setPrivacyShare] = useState(false);
  const [profileVisibility, setProfileVisibility] = useState("public");
  const [dataRetention, setDataRetention] = useState("1year");
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  
  // Notification Settings
  const [notifWeather, setNotifWeather] = useState(true);
  const [notifMarket, setNotifMarket] = useState(true);
  const [notifDisease, setNotifDisease] = useState(true);
  const [notifGeneral, setNotifGeneral] = useState(true);
  const [notifEmail, setNotifEmail] = useState(false);
  const [notifSMS, setNotifSMS] = useState(false);
  const [notifPush, setNotifPush] = useState(true);
  
  // Account Settings — dynamically populated with actual logged-in user data
  const [firstName, setFirstName] = useState(initialName.firstName);
  const [lastName, setLastName]   = useState(initialName.lastName);
  const [email, setEmail]         = useState(user?.email || farmProfile.farmer.email || "");
  const [phone, setPhone]         = useState(user?.phone || farmProfile.farmer.phone || "");
  const [farmSize, setFarmSize]   = useState(initialSize);
  const [cropTypes, setCropTypes] = useState(farmProfile.farm.currentCrops || "");
  const [location, setLocation]   = useState(initialLocation);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  // Sync state whenever active logged-in user changes
  useEffect(() => {
    if (!user) return;
    const currentProfile = farmProfileService.getFarmProfile(user);
    const { firstName: fName, lastName: lName } = splitFullName(
      user.full_name || user.username || currentProfile.farmer.fullName || ""
    );
    setFirstName(fName);
    setLastName(lName);
    setEmail(user.email || currentProfile.farmer.email || "");
    setPhone(user.phone || currentProfile.farmer.phone || "");
    
    const loc = user.location || (currentProfile.farmer.district && currentProfile.farmer.state ? `${currentProfile.farmer.district}, ${currentProfile.farmer.state}` : currentProfile.farmer.state || currentProfile.farmer.district || "");
    setLocation(loc);

    const fSize = user.farm_size ? String(user.farm_size).replace(/[^0-9.]/g, '') : (currentProfile.farm.farmSize ? String(currentProfile.farm.farmSize) : "");
    setFarmSize(fSize);

    setCropTypes(currentProfile.farm.currentCrops || "");
  }, [user]);

  const handleDetectLocation = async () => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation Unsupported",
        description: "Your browser does not support GPS location detection.",
        variant: "destructive",
      });
      return;
    }

    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          let place = "";
          let state = "";
          try {
            const res = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
            );
            if (res.ok) {
              const data = await res.json();
              place = data.city || data.locality || "";
              state = data.principalSubdivision || "";
            }
          } catch (e) {
            console.warn("Reverse geocode failed:", e);
          }

          const resolved = [place, state].filter(Boolean).join(", ") || `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
          setLocation(resolved);
          toast({
            title: "Location Detected! 📍",
            description: `Set location to ${resolved}`,
          });
        } catch (err: any) {
          toast({
            title: "Detection Failed",
            description: err?.message || "Could not resolve live location.",
            variant: "destructive",
          });
        } finally {
          setIsDetectingLocation(false);
        }
      },
      (err) => {
        setIsDetectingLocation(false);
        toast({
          title: "Location Access Denied",
          description: "Please check your browser location permissions.",
          variant: "destructive",
        });
      },
      { timeout: 10000 }
    );
  };
  
  // Display Settings
  const [compactMode, setCompactMode] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState("5");
  const [showTips, setShowTips] = useState(true);
  
  // Data Management
  const [exportFormat, setExportFormat] = useState("csv");
  const [backupFrequency, setBackupFrequency] = useState("weekly");
  
  const handleSaveSettings = async () => {
    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
    
    // 1. Update Auth user
    await updateUser({
      full_name: fullName || user?.full_name,
      email: email.trim() || user?.email,
      phone: phone.trim() || user?.phone,
      location: location.trim() || user?.location,
      farm_size: farmSize.trim() ? `${farmSize.trim()} Acres` : user?.farm_size,
    });

    // 2. Sync to farm profile service
    const current = farmProfileService.getFarmProfile(user);
    const locParts = location.split(',').map(s => s.trim()).filter(Boolean);
    const updated = {
      ...current,
      farmer: {
        ...current.farmer,
        fullName: fullName || current.farmer.fullName,
        email: email.trim() || current.farmer.email,
        phone: phone.trim() || current.farmer.phone,
        district: locParts[0] || current.farmer.district,
        state: locParts[1] || current.farmer.state,
      },
      farm: {
        ...current.farm,
        farmSize: parseFloat(farmSize) || current.farm.farmSize,
        currentCrops: cropTypes.trim() || current.farm.currentCrops,
      }
    };
    await farmProfileService.saveFarmProfile(updated, true, user?.id);

    toast({ 
      title: "Settings Saved", 
      description: "Your account details and preferences have been updated successfully." 
    });
  };
  
  const handleExportData = () => {
    toast({ 
      title: "Data Export Started", 
      description: `Your data will be exported in ${exportFormat.toUpperCase()} format.` 
    });
  };
  
  const handleDeleteAccount = () => {
    toast({ 
      title: "Account Deletion", 
      description: "Account deletion request has been submitted. You will receive an email confirmation.",
      variant: "destructive"
    });
  };
  
  const handleResetSettings = () => {
    const currentProfile = farmProfileService.getFarmProfile(user);
    const { firstName: fName, lastName: lName } = splitFullName(
      user?.full_name || user?.username || currentProfile.farmer.fullName || ""
    );
    setFirstName(fName);
    setLastName(lName);
    setEmail(user?.email || currentProfile.farmer.email || "");
    setPhone(user?.phone || currentProfile.farmer.phone || "");
    const loc = user?.location || (currentProfile.farmer.district && currentProfile.farmer.state ? `${currentProfile.farmer.district}, ${currentProfile.farmer.state}` : currentProfile.farmer.state || currentProfile.farmer.district || "");
    setLocation(loc);
    const fSize = user?.farm_size ? String(user.farm_size).replace(/[^0-9.]/g, '') : (currentProfile.farm.farmSize ? String(currentProfile.farm.farmSize) : "");
    setFarmSize(fSize);
    setCropTypes(currentProfile.farm.currentCrops || "");

    toast({ 
      title: "Settings Reset", 
      description: "Account details reset to your login profile data." 
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 w-full min-w-0 overflow-x-hidden">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-gradient-to-r from-primary to-success rounded-lg shrink-0">
          <SettingsIcon className="h-6 w-6 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold">Settings</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Manage your account preferences and application settings</p>
        </div>
      </div>

      <Tabs defaultValue="general" className="space-y-6 w-full min-w-0">
        <div className="w-full overflow-x-auto no-scrollbar scroll-smooth pb-1">
          <TabsList className="inline-flex min-w-full md:grid md:grid-cols-5 h-auto p-1 bg-muted rounded-xl gap-1 sm:gap-1.5">
            <TabsTrigger value="general" className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium shrink-0 whitespace-nowrap rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Globe className="h-4 w-4 shrink-0" />
              <span>General</span>
            </TabsTrigger>
            <TabsTrigger value="account" className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium shrink-0 whitespace-nowrap rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <User className="h-4 w-4 shrink-0" />
              <span>Account</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium shrink-0 whitespace-nowrap rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Bell className="h-4 w-4 shrink-0" />
              <span>Notifications</span>
            </TabsTrigger>
            <TabsTrigger value="privacy" className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium shrink-0 whitespace-nowrap rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Shield className="h-4 w-4 shrink-0" />
              <span>Privacy</span>
            </TabsTrigger>
            <TabsTrigger value="data" className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium shrink-0 whitespace-nowrap rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Database className="h-4 w-4 shrink-0" />
              <span>Data</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* General Settings Tab */}
        <TabsContent value="general" className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center space-x-2 text-lg sm:text-xl">
                <Globe className="h-5 w-5" />
                <span>General Preferences</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm font-medium">Language</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="hi">हिंदी</SelectItem>
                      <SelectItem value="te">తెలుగు</SelectItem>
                      <SelectItem value="ta">தமிழ்</SelectItem>
                      <SelectItem value="bn">বাংলা</SelectItem>
                      <SelectItem value="mr">मराठी</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Theme</Label>
                  <Select value={theme} onValueChange={setTheme}>
                    <SelectTrigger>
                      <SelectValue placeholder="Theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">Auto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Region</Label>
                  <Select value={region} onValueChange={setRegion}>
                    <SelectTrigger>
                      <SelectValue placeholder="Region" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IN">India</SelectItem>
                      <SelectItem value="US">United States</SelectItem>
                      <SelectItem value="UK">United Kingdom</SelectItem>
                      <SelectItem value="AU">Australia</SelectItem>
                      <SelectItem value="CA">Canada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Timezone</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger>
                      <SelectValue placeholder="Timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asia/Kolkata">Asia/Kolkata</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="America/New_York">America/New_York</SelectItem>
                      <SelectItem value="Europe/London">Europe/London</SelectItem>
                      <SelectItem value="Australia/Sydney">Australia/Sydney</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label className="text-sm font-medium">Display Settings</Label>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-md border">
                    <Switch checked={compactMode} onCheckedChange={setCompactMode} />
                    <div>
                      <p className="text-sm font-medium">Compact Mode</p>
                      <p className="text-xs text-muted-foreground">Use smaller spacing and condensed layout</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-md border">
                    <Switch checked={showTips} onCheckedChange={setShowTips} />
                    <div>
                      <p className="text-sm font-medium">Show Tips</p>
                      <p className="text-xs text-muted-foreground">Display helpful tips and guides</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-sm font-medium">Auto Refresh</Label>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-md border">
                    <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
                    <div>
                      <p className="text-sm font-medium">Enable Auto Refresh</p>
                      <p className="text-xs text-muted-foreground">Automatically refresh data</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Refresh Interval (minutes)</Label>
                    <Select value={refreshInterval} onValueChange={setRefreshInterval}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select interval" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 minute</SelectItem>
                        <SelectItem value="5">5 minutes</SelectItem>
                        <SelectItem value="10">10 minutes</SelectItem>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Account Settings Tab */}
        <TabsContent value="account" className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center space-x-2 text-lg sm:text-xl">
                <User className="h-5 w-5" />
                <span>Account Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm font-medium">First Name</Label>
                  <Input 
                    value={firstName} 
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Enter first name"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Last Name</Label>
                  <Input 
                    value={lastName} 
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Enter last name"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Email</Label>
                  <Input 
                    type="email"
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter email address"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Phone Number</Label>
                  <Input 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Enter phone number"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Farm Size (acres)</Label>
                  <Input 
                    value={farmSize} 
                    onChange={(e) => setFarmSize(e.target.value)}
                    placeholder="Enter farm size"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                    <Label className="text-sm font-medium">Location</Label>
                    <button
                      type="button"
                      onClick={handleDetectLocation}
                      disabled={isDetectingLocation}
                      className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                      title="Auto-detect current location via GPS"
                    >
                      <Compass className={`h-3.5 w-3.5 ${isDetectingLocation ? "animate-spin" : ""}`} />
                      {isDetectingLocation ? "Detecting..." : "Detect Location"}
                    </button>
                  </div>
                  <Input 
                    value={location} 
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Enter location (e.g. Vadodara, Gujarat)"
                  />
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium">Crop Types</Label>
                <Input 
                  value={cropTypes} 
                  onChange={(e) => setCropTypes(e.target.value)}
                  placeholder="Enter crop types (comma separated)"
                />
              </div>

              <Separator />

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2 flex-wrap">
                <Button onClick={handleSaveSettings} className="bg-primary hover:bg-primary/90 w-full sm:w-auto shrink-0">
                  <Save className="h-4 w-4 mr-2 shrink-0" />
                  Save Changes
                </Button>
                <Button variant="outline" onClick={handleResetSettings} className="w-full sm:w-auto shrink-0">
                  <RefreshCw className="h-4 w-4 mr-2 shrink-0" />
                  Reset to Default
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center space-x-2 text-lg sm:text-xl">
                <Bell className="h-5 w-5" />
                <span>Notification Preferences</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-6">
              <div className="space-y-4">
                <Label className="text-sm font-medium">Notification Methods</Label>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-md border">
                    <Switch checked={notifPush} onCheckedChange={setNotifPush} />
                    <div>
                      <p className="text-sm font-medium">Push Notifications</p>
                      <p className="text-xs text-muted-foreground">Browser notifications</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-md border">
                    <Switch checked={notifEmail} onCheckedChange={setNotifEmail} />
                    <div>
                      <p className="text-sm font-medium">Email</p>
                      <p className="text-xs text-muted-foreground">Email notifications</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-md border">
                    <Switch checked={notifSMS} onCheckedChange={setNotifSMS} />
                    <div>
                      <p className="text-sm font-medium">SMS</p>
                      <p className="text-xs text-muted-foreground">Text messages</p>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label className="text-sm font-medium">Notification Types</Label>
                <div className="space-y-3 p-3 rounded-md border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Weather Alerts</p>
                      <p className="text-xs text-muted-foreground">Get notified about weather changes</p>
                    </div>
                    <Switch checked={notifWeather} onCheckedChange={setNotifWeather} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Market Price Updates</p>
                      <p className="text-xs text-muted-foreground">Stay updated with market prices</p>
                    </div>
                    <Switch checked={notifMarket} onCheckedChange={setNotifMarket} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Disease Alerts</p>
                      <p className="text-xs text-muted-foreground">Important crop disease notifications</p>
                    </div>
                    <Switch checked={notifDisease} onCheckedChange={setNotifDisease} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">General Updates</p>
                      <p className="text-xs text-muted-foreground">App updates and announcements</p>
                    </div>
                    <Switch checked={notifGeneral} onCheckedChange={setNotifGeneral} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Privacy Tab */}
        <TabsContent value="privacy" className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center space-x-2 text-lg sm:text-xl">
                <Shield className="h-5 w-5" />
                <span>Privacy & Security</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-6">
              <div className="space-y-4">
                <Label className="text-sm font-medium">Data Sharing</Label>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-md border">
                    <Switch checked={privacyShare} onCheckedChange={setPrivacyShare} />
                    <div>
                      <p className="text-sm font-medium">Allow Data Sharing</p>
                      <p className="text-xs text-muted-foreground">Help improve recommendations and alerts</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-md border">
                    <Switch checked={analyticsEnabled} onCheckedChange={setAnalyticsEnabled} />
                    <div>
                      <p className="text-sm font-medium">Analytics & Usage Data</p>
                      <p className="text-xs text-muted-foreground">Help us improve the application</p>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label className="text-sm font-medium">Profile Visibility</Label>
                <Select value={profileVisibility} onValueChange={setProfileVisibility}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="friends">Friends Only</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <Label className="text-sm font-medium">Data Retention</Label>
                <Select value={dataRetention} onValueChange={setDataRetention}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select retention period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6months">6 Months</SelectItem>
                    <SelectItem value="1year">1 Year</SelectItem>
                    <SelectItem value="2years">2 Years</SelectItem>
                    <SelectItem value="forever">Forever</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label className="text-sm font-medium">Account Actions</Label>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Account
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data Management Tab */}
        <TabsContent value="data" className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center space-x-2 text-lg sm:text-xl">
                <Database className="h-5 w-5" />
                <span>Data Management</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-6">
              <div className="space-y-4">
                <Label className="text-sm font-medium">Export Data</Label>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Export Format</Label>
                    <Select value={exportFormat} onValueChange={setExportFormat}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="csv">CSV</SelectItem>
                        <SelectItem value="json">JSON</SelectItem>
                        <SelectItem value="excel">Excel</SelectItem>
                        <SelectItem value="pdf">PDF</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleExportData} className="w-full">
                      <Download className="h-4 w-4 mr-2" />
                      Export Data
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label className="text-sm font-medium">Backup Settings</Label>
                <div>
                  <Label className="text-sm font-medium">Backup Frequency</Label>
                  <Select value={backupFrequency} onValueChange={setBackupFrequency}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="manual">Manual Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label className="text-sm font-medium">Storage Usage</Label>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Used Storage</span>
                    <span>2.3 GB / 5 GB</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: '46%' }}></div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-4 flex-wrap">
                <Button onClick={handleSaveSettings} className="bg-primary hover:bg-primary/90 w-full sm:w-auto shrink-0">
                  <Save className="h-4 w-4 mr-2 shrink-0" />
                  Save All Settings
                </Button>
                <Button variant="outline" onClick={handleResetSettings} className="w-full sm:w-auto shrink-0">
                  <RefreshCw className="h-4 w-4 mr-2 shrink-0" />
                  Reset Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;



