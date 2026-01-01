
import { useState, useEffect } from "react";
import { entities, User, integrations } from "@/api/entities";
import { supabase } from '@/utils';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Code, Check, Loader2, Image, Mail, Globe, Type, Download, Trash2, PackagePlus, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function SiteSettings() {
  const [user, setUser] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [generalSettingsSaved, setGeneralSettingsSaved] = useState(false);
  const [managedVersions, setManagedVersions] = useState([]);
  const [activeVersion, setActiveVersion] = useState(null);
  const [loadingManagedVersions, setLoadingManagedVersions] = useState(false);
  const [generalSettings, setGeneralSettings] = useState({
    platform_url: "",
    platform_name: "",
    platform_subtitle: "",
    platform_logo: "",
    platform_icon: "",
    platform_contact_email: ""
  });
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await User.me();
    setUser(currentUser);

    if (currentUser.role !== "admin") {
      navigate(createPageUrl("Dashboard"));
    }
  };

  const loadManagedVersions = async () => {
    try {
      setLoadingManagedVersions(true);
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/getConnectorVersions`,
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          }
        }
      );
      const data = await response.json();
      if (data.versions) {
        setManagedVersions(data.versions);
      }
      
      // Load active version
      const settingsResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/connectorVersionSettings`,
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          }
        }
      );
      const settingsData = await settingsResponse.json();
      if (settingsData.version) {
        setActiveVersion(settingsData.version);
      }
    } catch (error) {
      console.error('Error loading managed versions:', error);
    } finally {
      setLoadingManagedVersions(false);
    }
  };

  const { data: settings = [] } = useQuery({
    queryKey: ['site-settings'],
    queryFn: () => entities.SiteSettings.list(),
    initialData: []
  });

  // Load managed versions on mount
  useEffect(() => {
    loadManagedVersions();
  }, []);

  // Load general settings when data is fetched
  useEffect(() => {
    if (settings.length > 0) {
      setGeneralSettings({
        platform_url: settings.find(s => s.setting_key === 'platform_url')?.setting_value || "",
        platform_name: settings.find(s => s.setting_key === 'platform_name')?.setting_value || "",
        platform_subtitle: settings.find(s => s.setting_key === 'platform_subtitle')?.setting_value || "",
        platform_logo: settings.find(s => s.setting_key === 'platform_logo')?.setting_value || "",
        platform_icon: settings.find(s => s.setting_key === 'platform_icon')?.setting_value || "",
        platform_contact_email: settings.find(s => s.setting_key === 'platform_contact_email')?.setting_value || ""
      });
    }
  }, [settings]);

  const updateSettingMutation = useMutation({
    mutationFn: async ({ settingKey, value, description }) => {
      const existing = settings.find((s) => s.setting_key === settingKey);

      if (existing) {
        return entities.SiteSettings.update(existing.id, {
          setting_value: value
        });
      } else {
        return entities.SiteSettings.create({
          setting_key: settingKey,
          setting_value: value,
          description: description || settingKey
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-settings'] });
    }
  });

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setUploadingLogo(true);
      try {
        const { file_url } = await integrations.Core.UploadFile({ file });
        setGeneralSettings(prev => ({ ...prev, platform_logo: file_url }));
      } catch (error) {
        console.error("Error uploading logo:", error);
        alert("Fout bij uploaden van logo. Probeer opnieuw.");
      } finally {
        setUploadingLogo(false);
      }
    } else {
      alert("Selecteer een geldig afbeeldingsbestand");
    }
  };

  const handleIconUpload = async (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setUploadingIcon(true);
      try {
        const { file_url } = await integrations.Core.UploadFile({ file });
        setGeneralSettings(prev => ({ ...prev, platform_icon: file_url }));
      } catch (error) {
        console.error("Error uploading icon:", error);
        alert("Fout bij uploaden van icon. Probeer opnieuw.");
      } finally {
        setUploadingIcon(false);
      }
    } else {
      alert("Selecteer een geldig afbeeldingsbestand");
    }
  };

  const handleSaveGeneralSettings = async () => {
    try {
      await Promise.all([
        updateSettingMutation.mutateAsync({
          settingKey: 'platform_url',
          value: generalSettings.platform_url,
          description: 'Platform URL'
        }),
        updateSettingMutation.mutateAsync({
          settingKey: 'platform_name',
          value: generalSettings.platform_name,
          description: 'Platform Name'
        }),
        updateSettingMutation.mutateAsync({
          settingKey: 'platform_subtitle',
          value: generalSettings.platform_subtitle,
          description: 'Platform Subtitle'
        }),
        updateSettingMutation.mutateAsync({
          settingKey: 'platform_logo',
          value: generalSettings.platform_logo,
          description: 'Platform Logo URL'
        }),
        updateSettingMutation.mutateAsync({
          settingKey: 'platform_icon',
          value: generalSettings.platform_icon,
          description: 'Platform Icon URL'
        }),
        updateSettingMutation.mutateAsync({
          settingKey: 'platform_contact_email',
          value: generalSettings.platform_contact_email,
          description: 'Platform Contact Email'
        })
      ]);
      setGeneralSettingsSaved(true);
      setTimeout(() => setGeneralSettingsSaved(false), 3000);
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Fout bij opslaan van instellingen. Probeer opnieuw.");
    }
  };

  const handleDownloadConnector = async (connector) => {
    try {
      // Fetch the file
      const response = await fetch(connector.file_url);
      const blob = await response.blob();
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `wphub-connector-v${connector.version}.zip`;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading connector:', error);
      // Fallback to direct link
      window.open(connector.file_url, '_blank');
    }
  };

  const handleSetActiveVersion = async (version) => {
    try {
      await updateSettingMutation.mutateAsync({
        settingKey: 'active_connector_version',
        value: version,
        description: 'Active Connector Plugin Version'
      });
      alert('✅ Actieve versie ingesteld!');
    } catch (error) {
      alert('❌ Fout bij instellen versie: ' + error.message);
    }
  };

  const handleSetManagedActiveVersion = async (version, url) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/connectorVersionSettings`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ version, url })
        }
      );
      if (response.ok) {
        setActiveVersion(version);
        alert('✅ Actieve versie ingesteld!');
      } else {
        alert('❌ Fout bij instellen versie');
      }
    } catch (error) {
      alert('❌ Fout: ' + error.message);
    }
  };

  if (!user || user.role !== "admin") {
    return (
      <div className="p-6 md:p-8">
        <div className="max-w-7xl mx-auto text-center py-12">
          <p className="text-gray-500">Toegang geweigerd. Alleen admins kunnen deze pagina bekijken.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Site Instellingen</h1>
          <p className="text-gray-500">Beheer globale instellingen voor het platform</p>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList>
            <TabsTrigger value="general" className="gap-2">
              <Settings className="w-4 h-4" />
              Algemene Instellingen
            </TabsTrigger>
            <TabsTrigger value="connector" className="gap-2">
              <Code className="w-4 h-4" />
              Connector Plugin
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card className="border-none shadow-lg">
              <CardHeader className="border-b border-gray-100">
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-indigo-600" />
                  Platform Instellingen
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div>
                    <Label htmlFor="platform_url" className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-gray-500" />
                      Platform URL
                    </Label>
                    <Input
                      id="platform_url"
                      type="url"
                      placeholder="https://wphub.pro"
                      value={generalSettings.platform_url}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, platform_url: e.target.value })}
                      className="mt-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">De URL waar het platform bereikbaar is</p>
                  </div>

                  <div>
                    <Label htmlFor="platform_name" className="flex items-center gap-2">
                      <Type className="w-4 h-4 text-gray-500" />
                      Platform Naam
                    </Label>
                    <Input
                      id="platform_name"
                      placeholder="WP Plugin Hub"
                      value={generalSettings.platform_name}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, platform_name: e.target.value })}
                      className="mt-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">De naam van het platform (wordt weergegeven in sidebar)</p>
                  </div>

                  <div>
                    <Label htmlFor="platform_subtitle" className="flex items-center gap-2">
                      <Type className="w-4 h-4 text-gray-500" />
                      Platform Subtitle
                    </Label>
                    <Input
                      id="platform_subtitle"
                      placeholder="Plugin Management"
                      value={generalSettings.platform_subtitle}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, platform_subtitle: e.target.value })}
                      className="mt-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">Korte ondertitel onder de naam (bijv. "Plugin Management")</p>
                  </div>

                  <div>
                    <Label className="flex items-center gap-2">
                      <Image className="w-4 h-4 text-gray-500" />
                      Platform Logo
                    </Label>
                    <div className="mt-2 space-y-3">
                      {generalSettings.platform_logo && (
                        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                          <img 
                            src={generalSettings.platform_logo} 
                            alt="Platform Logo" 
                            className="h-16 object-contain"
                          />
                        </div>
                      )}
                      <label className={`flex items-center justify-center w-full p-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                        uploadingLogo ? 'border-indigo-400 bg-indigo-50' : 'hover:border-indigo-400 border-gray-300'
                      }`}>
                        <div className="text-center">
                          {uploadingLogo ? (
                            <>
                              <Loader2 className="w-8 h-8 mx-auto mb-2 text-indigo-600 animate-spin" />
                              <p className="text-sm text-indigo-600">Uploaden...</p>
                            </>
                          ) : (
                            <>
                              <Image className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                              <p className="text-sm text-gray-600">
                                {generalSettings.platform_logo ? "Klik om nieuw logo te uploaden" : "Klik om logo te uploaden"}
                              </p>
                            </>
                          )}
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                          disabled={uploadingLogo}
                        />
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Logo wordt weergegeven in de navigatie</p>
                  </div>

                  <div>
                    <Label className="flex items-center gap-2">
                      <Image className="w-4 h-4 text-gray-500" />
                      Platform Icon
                    </Label>
                    <div className="mt-2 space-y-3">
                      {generalSettings.platform_icon && (
                        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                          <img 
                            src={generalSettings.platform_icon} 
                            alt="Platform Icon" 
                            className="h-12 w-12 object-contain"
                          />
                        </div>
                      )}
                      <label className={`flex items-center justify-center w-full p-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                        uploadingIcon ? 'border-indigo-400 bg-indigo-50' : 'hover:border-indigo-400 border-gray-300'
                      }`}>
                        <div className="text-center">
                          {uploadingIcon ? (
                            <>
                              <Loader2 className="w-8 h-8 mx-auto mb-2 text-indigo-600 animate-spin" />
                              <p className="text-sm text-indigo-600">Uploaden...</p>
                            </>
                          ) : (
                            <>
                              <Image className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                              <p className="text-sm text-gray-600">
                                {generalSettings.platform_icon ? "Klik om nieuwe icon te uploaden" : "Klik om icon te uploaden"}
                              </p>
                            </>
                          )}
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleIconUpload}
                          className="hidden"
                          disabled={uploadingIcon}
                        />
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Icon wordt gebruikt in sidebar en als favicon (vierkant formaat aanbevolen)</p>
                  </div>

                  <div>
                    <Label htmlFor="platform_contact_email" className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-500" />
                      Contact E-mail
                    </Label>
                    <Input
                      id="platform_contact_email"
                      type="email"
                      placeholder="info@wphub.pro"
                      value={generalSettings.platform_contact_email}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, platform_contact_email: e.target.value })}
                      className="mt-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">Contact e-mailadres voor ondersteuning</p>
                  </div>

                  <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                    <Button 
                      onClick={handleSaveGeneralSettings}
                      disabled={updateSettingMutation.isPending}
                      className="bg-indigo-600 hover:bg-indigo-700"
                    >
                      {generalSettingsSaved ? (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Opgeslagen
                        </>
                      ) : (
                        "Wijzigingen Opslaan"
                      )}
                    </Button>
                    {generalSettingsSaved && (
                      <p className="text-sm text-green-600">
                        ✓ Instellingen succesvol opgeslagen
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="connector">
            <div className="space-y-6">
              {/* Managed Connector Versions Card */}
              <Card className="border-none shadow-lg">
                <CardHeader className="border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <PackagePlus className="w-5 h-5 text-blue-600" />
                      Beheerde Connector Versies
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadManagedVersions}
                      disabled={loadingManagedVersions}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Vernieuwen
                    </Button>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    Deze versies worden beheerd via het deployment script en zijn opgeslagen in Supabase
                  </p>
                </CardHeader>
                <CardContent className="p-6">
                  {loadingManagedVersions ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mr-2" />
                      <p className="text-gray-600">Versies laden...</p>
                    </div>
                  ) : managedVersions.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <PackagePlus className="w-16 h-16 mx-auto mb-4 opacity-30" />
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">Geen versies beschikbaar</h3>
                      <p className="text-gray-500">Voer het deployment script uit om connector versies te uploaden</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Active Version */}
                      {activeVersion && managedVersions.find(v => v.version === activeVersion) && (
                        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-4 rounded-xl border border-blue-200 mb-6">
                          <div className="flex items-start gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <p className="text-sm font-semibold text-blue-900">Momenteel Actieve Versie</p>
                                <Badge className="bg-blue-100 text-blue-700">Actief</Badge>
                              </div>
                              <p className="text-2xl font-bold text-blue-700">v{activeVersion}</p>
                              <p className="text-xs text-blue-600 mt-1">
                                Download URL: {managedVersions.find(v => v.version === activeVersion)?.url}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(managedVersions.find(v => v.version === activeVersion)?.url)}
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* All Versions List */}
                      <div className="space-y-3">
                        {managedVersions.map((version) => (
                          <div 
                            key={version.version}
                            className="p-4 rounded-xl border border-gray-200 hover:border-indigo-200 transition-all"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h3 className="font-semibold text-gray-900">v{version.version}</h3>
                                  {version.version === activeVersion && (
                                    <Badge className="bg-green-100 text-green-700">Actief</Badge>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600 mb-2">
                                  Grootte: {version.size ? `${(version.size / 1024).toFixed(2)} KB` : 'N/A'}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {version.created_at && `Geüpload op ${format(new Date(version.created_at), "d MMM yyyy HH:mm", { locale: nl })}`}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant={version.version === activeVersion ? "default" : "outline"}
                                  onClick={() => handleSetManagedActiveVersion(version.version, version.url)}
                                  disabled={version.version === activeVersion}
                                  className={version.version === activeVersion ? "bg-green-600 hover:bg-green-700" : ""}
                                >
                                  {version.version === activeVersion ? "✓ Actief" : "Activeer"}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => window.open(version.url)}
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
