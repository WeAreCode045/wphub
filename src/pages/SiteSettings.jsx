
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Code, Check, Loader2, Image, Mail, Globe, Type, Download, Trash2, PackagePlus } from "lucide-react";
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
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [newConnector, setNewConnector] = useState({ version: "", description: "" });
  const [connectorCode, setConnectorCode] = useState("");
  const [isEditingCode, setIsEditingCode] = useState(false);
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
    const currentUser = await base44.auth.me();
    setUser(currentUser);

    if (currentUser.role !== "admin") {
      navigate(createPageUrl("Dashboard"));
    }
  };

  const { data: settings = [] } = useQuery({
    queryKey: ['site-settings'],
    queryFn: () => base44.entities.SiteSettings.list(),
    initialData: []
  });

  const { data: connectors = [] } = useQuery({
    queryKey: ['connectors'],
    queryFn: () => base44.entities.Connector.list("-created_date"),
    initialData: []
  });

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

  // Load connector code from active version
  useEffect(() => {
    if (connectors.length > 0) {
      const activeVersion = settings.find(s => s.setting_key === 'active_connector_version')?.setting_value;
      const activeConnector = connectors.find(c => c.version === activeVersion);
      
      if (activeConnector && activeConnector.plugin_code) {
        setConnectorCode(activeConnector.plugin_code);
      } else if (connectors[0]?.plugin_code) {
        // Fallback to latest connector if no active version or active version has no code
        setConnectorCode(connectors[0].plugin_code);
      }
    }
  }, [connectors, settings]);

  const updateSettingMutation = useMutation({
    mutationFn: async ({ settingKey, value, description }) => {
      const existing = settings.find((s) => s.setting_key === settingKey);

      if (existing) {
        return base44.entities.SiteSettings.update(existing.id, {
          setting_value: value
        });
      } else {
        return base44.entities.SiteSettings.create({
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

  const generateConnectorMutation = useMutation({
    mutationFn: async (data) => {
      const response = await base44.functions.invoke('generateConnectorPlugin', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connectors'] });
      setShowGenerateDialog(false);
      setNewConnector({ version: "", description: "" });
      setIsEditingCode(false);
      alert('✅ Connector plugin succesvol gegenereerd!');
    },
    onError: (error) => {
      alert('❌ Fout bij genereren: ' + error.message);
    }
  });

  const deleteConnectorMutation = useMutation({
    mutationFn: async (connector_id) => {
      const response = await base44.functions.invoke('deleteConnectorPlugin', { connector_id });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connectors'] });
    }
  });

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setUploadingLogo(true);
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
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
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
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

  const handleGenerateConnector = () => {
    if (newConnector.version) {
      const platformUrl = settings.find(s => s.setting_key === 'platform_url')?.setting_value || 'https://wphub.pro';
      
      generateConnectorMutation.mutate({
        ...newConnector,
        hub_url: platformUrl,
        api_key: '{{API_KEY}}', // Placeholder - wordt per site ingevuld
        custom_code: isEditingCode ? connectorCode : null
      });
    }
  };

  const handleSaveAsNewVersion = () => {
    if (!newConnector.version) {
      alert('Voer een versienummer in');
      return;
    }
    
    // Ensure isEditingCode is true when saving custom code
    // The handleGenerateConnector will then use the current connectorCode
    setIsEditingCode(true); // Explicitly set to true for this context
    handleGenerateConnector();
  };

  const handleResetCode = () => {
    if (confirm('Weet je zeker dat je de code wilt resetten naar de originele template?')) {
      const activeVersion = settings.find(s => s.setting_key === 'active_connector_version')?.setting_value;
      const activeConnector = connectors.find(c => c.version === activeVersion);
      
      if (activeConnector && activeConnector.plugin_code) {
        setConnectorCode(activeConnector.plugin_code);
      } else if (connectors.length > 0 && connectors[0]?.plugin_code) {
        // Fallback to the latest connector's code if active is not found or has no code
        setConnectorCode(connectors[0].plugin_code);
      } else {
        setConnectorCode(""); // Default to empty if no connector code is available
      }
      
      setIsEditingCode(false);
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
      link.download = `wp-plugin-hub-connector-v${connector.version}.zip`;
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

  const activeVersion = settings.find(s => s.setting_key === 'active_connector_version')?.setting_value;
  const activeConnector = connectors.find(c => c.version === activeVersion);

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
              {/* Connector Code Editor Card */}
              <Card className="border-none shadow-lg">
                <CardHeader className="border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Code className="w-5 h-5 text-indigo-600" />
                      Connector Code
                    </CardTitle>
                    <div className="flex gap-2">
                      {isEditingCode && (
                        <Button
                          variant="outline"
                          onClick={handleResetCode}
                          size="sm"
                        >
                          Reset
                        </Button>
                      )}
                      <Button
                        variant={isEditingCode ? "default" : "outline"}
                        onClick={() => setIsEditingCode(!isEditingCode)}
                        size="sm"
                      >
                        {isEditingCode ? "Stop Bewerken" : "Bewerken"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Code className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 mb-1">
                            Connector Plugin Template
                          </p>
                          <p className="text-xs text-gray-600">
                            Deze code wordt gebruikt om de connector plugin te genereren. 
                            Je kunt aanpassingen maken en opslaan als een nieuwe versie.
                            De placeholders {`{{API_KEY}}`} en {`{{HUB_URL}}`} worden automatisch ingevuld per site.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="relative rounded-lg overflow-hidden border border-gray-700">
                      {/* Line numbers */}
                      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gray-800 text-gray-500 text-xs font-mono select-none overflow-hidden">
                        {connectorCode.split('\n').map((_, i) => (
                          <div key={i} className="text-right pr-2 leading-6 h-6">
                            {i + 1}
                          </div>
                        ))}
                      </div>
                      
                      <textarea
                        value={connectorCode}
                        onChange={(e) => {
                          setConnectorCode(e.target.value);
                          setIsEditingCode(true);
                        }}
                        onKeyDown={(e) => {
                          // Handle tab key
                          if (e.key === 'Tab') {
                            e.preventDefault();
                            const start = e.target.selectionStart;
                            const end = e.target.selectionEnd;
                            const value = e.target.value;
                            const newValue = value.substring(0, start) + '    ' + value.substring(end);
                            setConnectorCode(newValue);
                            setIsEditingCode(true);
                            // Set cursor position after the tab
                            setTimeout(() => {
                              e.target.selectionStart = e.target.selectionEnd = start + 4;
                            }, 0);
                          }
                        }}
                        className="w-full h-[600px] font-mono text-xs p-4 pl-16 bg-gray-900 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        style={{ 
                          resize: 'vertical',
                          minHeight: '400px',
                          maxHeight: '1000px',
                          lineHeight: '1.5rem',
                          whiteSpace: 'pre',
                          overflowWrap: 'normal',
                          overflowX: 'auto'
                        }}
                        spellCheck="false"
                        wrap="off"
                      />
                    </div>

                    {isEditingCode && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <PackagePlus className="w-4 h-4 text-amber-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-amber-900 mb-3">
                              Opslaan als Nieuwe Versie
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label htmlFor="code-version" className="text-xs">
                                  Versie Nummer *
                                </Label>
                                <Input
                                  id="code-version"
                                  placeholder="4.1.0"
                                  value={newConnector.version}
                                  onChange={(e) => setNewConnector({ ...newConnector, version: e.target.value })}
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label htmlFor="code-description" className="text-xs">
                                  Beschrijving (optioneel)
                                </Label>
                                <Input
                                  id="code-description"
                                  placeholder="Custom modificaties..."
                                  value={newConnector.description}
                                  onChange={(e) => setNewConnector({ ...newConnector, description: e.target.value })}
                                  className="mt-1"
                                />
                              </div>
                            </div>
                            <Button
                              onClick={handleSaveAsNewVersion}
                              disabled={!newConnector.version || generateConnectorMutation.isPending}
                              className="mt-3 bg-amber-600 hover:bg-amber-700"
                            >
                              {generateConnectorMutation.isPending ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Opslaan...
                                </>
                              ) : (
                                <>
                                  <PackagePlus className="w-4 h-4 mr-2" />
                                  Opslaan als Versie {newConnector.version}
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Version Management Card */}
              <Card className="border-none shadow-lg">
                <CardHeader className="border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Code className="w-5 h-5 text-indigo-600" />
                      Versie Beheer
                    </CardTitle>
                    <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
                      <DialogTrigger asChild>
                        <Button className="bg-indigo-600 hover:bg-indigo-700">
                          <PackagePlus className="w-4 h-4 mr-2" />
                          Nieuwe Standaard Versie
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Nieuwe Connector Plugin Genereren</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                          <div>
                            <Label htmlFor="version">Versie Nummer *</Label>
                            <Input
                              id="version"
                              placeholder="4.0.0"
                              value={newConnector.version}
                              onChange={(e) => setNewConnector({ ...newConnector, version: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label htmlFor="description">Beschrijving (optioneel)</Label>
                            <Input
                              id="description"
                              placeholder="Beschrijving van deze versie"
                              value={newConnector.description}
                              onChange={(e) => setNewConnector({ ...newConnector, description: e.target.value })}
                            />
                          </div>
                          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                            <p className="text-sm text-blue-800">
                              De connector plugin bevat de hardcoded platform URL: <strong>https://wphub.pro</strong>
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              onClick={handleGenerateConnector}
                              disabled={!newConnector.version || generateConnectorMutation.isPending}
                              className="flex-1"
                            >
                              {generateConnectorMutation.isPending ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Genereren...
                                </>
                              ) : (
                                "Plugin Genereren"
                              )}
                            </Button>
                            <Button 
                              variant="outline"
                              onClick={() => setShowGenerateDialog(false)}
                            >
                              Annuleren
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div>
                      <Label>Actieve Versie voor Downloads</Label>
                      <Select
                        value={activeVersion || ""}
                        onValueChange={handleSetActiveVersion}
                      >
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="Selecteer een versie" />
                        </SelectTrigger>
                        <SelectContent>
                          {connectors.map((connector) => (
                            <SelectItem key={connector.id} value={connector.version}>
                              v{connector.version} - {connector.description || 'Geen beschrijving'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500 mt-1">Deze versie wordt door gebruikers gedownload</p>
                    </div>

                    {activeConnector && (
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-green-900">Actieve Versie</p>
                            <p className="text-lg font-bold text-green-700 mt-1">v{activeConnector.version}</p>
                            <p className="text-xs text-green-600 mt-1">{activeConnector.description}</p>
                          </div>
                          <Button 
                            onClick={() => handleDownloadConnector(activeConnector)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* All Versions List Card */}
              <Card className="border-none shadow-lg">
                <CardHeader className="border-b border-gray-100">
                  <CardTitle>Alle Versies</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {connectors.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Code className="w-16 h-16 mx-auto mb-4 opacity-30" />
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">Nog geen versies</h3>
                      <p className="text-gray-500 mb-6">Genereer je eerste connector plugin versie</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {connectors.map((connector) => (
                        <div 
                          key={connector.id}
                          className="p-4 rounded-xl border border-gray-200 hover:border-indigo-200 transition-all"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-semibold text-gray-900">v{connector.version}</h3>
                                {connector.version === activeVersion && (
                                  <Badge className="bg-green-100 text-green-700 border-green-200">
                                    Actief
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mb-2">{connector.description}</p>
                              <p className="text-xs text-gray-500">
                                Aangemaakt op {format(new Date(connector.created_date), "d MMM yyyy HH:mm", { locale: nl })}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleDownloadConnector(connector)}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (confirm('Weet je zeker dat je deze versie wilt verwijderen?')) {
                                    deleteConnectorMutation.mutate(connector.id);
                                  }
                                }}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
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
