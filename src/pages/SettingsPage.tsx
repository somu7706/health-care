import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Settings, Loader2, Moon, Sun, Bell, Shield, Watch, Wifi, WifiOff } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/hooks/useI18n";

export default function SettingsPage() {
  const { profile, refreshProfile } = useAuth();
  const { theme, toggle } = useTheme();
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const [name, setName] = useState(profile?.name || "");
  const [age, setAge] = useState(profile?.age?.toString() || "");
  const [gender, setGender] = useState(profile?.gender || "");
  const [location, setLocation] = useState(profile?.location || "");
  const [saving, setSaving] = useState(false);
  const [connectingWatch, setConnectingWatch] = useState(false);

  const { data: wearableStatus } = useQuery({
    queryKey: ["wearable-data"],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("wearable-sync", {
        body: { action: "get-latest", data: {} },
      });
      return data as { connected: boolean };
    },
  });

  const watchConnected = wearableStatus?.connected;

  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setAge(profile.age?.toString() || "");
      setGender(profile.gender || "");
      setLocation(profile.location || "");
    }
  }, [profile]);

  const { data: notifications } = useQuery({
    queryKey: ["all-notifications"],
    queryFn: async () => {
      const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      name,
      age: age ? parseInt(age) : null,
      gender: gender || null,
      location: location || null,
    }).eq("user_id", profile.user_id);

    if (error) {
      toast.error(t("settings.saveFailed"));
    } else {
      toast.success(t("settings.profileUpdated"));
      refreshProfile();
    }
    setSaving(false);
  };

  const dismissNotification = async (id: string) => {
    await supabase.from("notifications").update({ status: "dismissed" }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["all-notifications"] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    toast.success(t("settings.notificationDismissed"));
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">{t("settings.title")}</h1>
          <p className="text-muted-foreground">{t("settings.description")}</p>
        </div>
      </div>

      <div className="border border-border rounded-xl p-6 bg-card space-y-4">
        <h2 className="font-semibold text-lg">{t("settings.profileInfo")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("settings.fullName")}</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t("settings.email")}</Label>
            <Input id="email" value={profile?.email || ""} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="age">{t("settings.age")}</Label>
            <Input id="age" type="number" value={age} onChange={e => setAge(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gender">{t("settings.gender")}</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger><SelectValue placeholder={t("settings.selectGender")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">{t("settings.male")}</SelectItem>
                <SelectItem value="Female">{t("settings.female")}</SelectItem>
                <SelectItem value="Other">{t("settings.other")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="location">{t("settings.location")}</Label>
            <Input id="location" value={location} onChange={e => setLocation(e.target.value)} placeholder={t("settings.locationPlaceholder")} />
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {t("common.save")}
        </Button>
      </div>

      <div className="border border-border rounded-xl p-6 bg-card space-y-4">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          {theme === "dark" ? <Moon className="h-5 w-5 text-primary" /> : <Sun className="h-5 w-5 text-primary" />}
          {t("settings.appearance")}
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">{t("settings.darkMode")}</p>
            <p className="text-xs text-muted-foreground">{t("settings.darkModeDesc")}</p>
          </div>
          <Button variant="outline" onClick={toggle} className="gap-2">
            {theme === "dark" ? <><Sun className="h-4 w-4" /> {t("settings.lightMode")}</> : <><Moon className="h-4 w-4" /> {t("settings.darkMode")}</>}
          </Button>
        </div>
      </div>

      <div className="border border-border rounded-xl p-6 bg-card space-y-4">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" /> {t("settings.activeReminders")}
        </h2>
        {notifications && notifications.filter(n => n.status === "active").length > 0 ? (
          <div className="space-y-2">
            {notifications.filter(n => n.status === "active").map(n => (
              <div key={n.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm">{n.message}</span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => dismissNotification(n.id)}>
                  {t("common.dismiss")}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("settings.noReminders")}</p>
        )}
      </div>

      {/* Smartwatch Connection */}
      <div className="border border-border rounded-xl p-6 bg-card space-y-4">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <Watch className="h-5 w-5 text-primary" /> {t("wearable.smartwatch")}
        </h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {watchConnected ? (
              <Wifi className="h-5 w-5 text-green-500" />
            ) : (
              <WifiOff className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium text-sm">
                {watchConnected ? t("wearable.statusConnected") : t("wearable.statusDisconnected")}
              </p>
              <p className="text-xs text-muted-foreground">
                {watchConnected ? t("wearable.syncingData") : t("wearable.connectDesc")}
              </p>
            </div>
          </div>
          <Button
            variant={watchConnected ? "destructive" : "default"}
            size="sm"
            disabled={connectingWatch}
            onClick={async () => {
              setConnectingWatch(true);
              try {
                if (watchConnected) {
                  await supabase.functions.invoke("wearable-sync", {
                    body: { action: "disconnect", data: {} },
                  });
                  toast.success(t("wearable.disconnected"));
                } else {
                  await supabase.functions.invoke("wearable-sync", {
                    body: { action: "sync-demo", data: {} },
                  });
                  toast.success(t("wearable.connected"));
                }
                queryClient.invalidateQueries({ queryKey: ["wearable-data"] });
              } catch (err: any) {
                toast.error(err.message);
              } finally {
                setConnectingWatch(false);
              }
            }}
            className="gap-2"
          >
            {connectingWatch ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {watchConnected ? t("wearable.disconnect") : t("wearable.connectSmartwatch")}
          </Button>
        </div>
      </div>

      <div className="border border-border rounded-xl p-6 bg-card space-y-3">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" /> {t("settings.dataPrivacy")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("settings.dataPrivacyDesc")}
        </p>
      </div>
    </div>
  );
}
