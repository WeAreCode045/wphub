
import { useState, useEffect } from "react";
import { User, integrations } from "@/api/entities";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User as UserIcon, Mail, Building, Phone, Upload, Check, Copy, CheckCircle, Shield } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge"; // Assuming this component exists

export default function AccountSettings() {
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    company: "",
    phone: "",
    avatar_url: "",
    two_fa_enabled: false,
    billing_address: "",
    billing_city: "",
    billing_postal_code: "",
    billing_country: "NL",
    vat_number: ""
  });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copiedUserId, setCopiedUserId] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await User.me();
    setUser(currentUser);
    setFormData({
      full_name: currentUser.full_name || "",
      email: currentUser.email || "",
      company: currentUser.company || "",
      phone: currentUser.phone || "",
      avatar_url: currentUser.avatar_url || "",
      two_fa_enabled: currentUser.two_fa_enabled || false,
      billing_address: currentUser.billing_address || "",
      billing_city: currentUser.billing_city || "",
      billing_postal_code: currentUser.billing_postal_code || "",
      billing_country: currentUser.billing_country || "NL",
      vat_number: currentUser.vat_number || ""
    });
  };

  const updateUserMutation = useMutation({
    mutationFn: (data) => User.updateMe(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      loadUser();
    },
  });

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadingAvatar(true);
      try {
        const { file_url } = await integrations.Core.UploadFile({ file });
        setFormData(prev => ({ ...prev, avatar_url: file_url }));
        updateUserMutation.mutate({ avatar_url: file_url });
      } catch (error) {
        console.error("Error uploading avatar:", error);
      }
      setUploadingAvatar(false);
    }
  };

  const handleSave = () => {
    updateUserMutation.mutate({
      company: formData.company,
      phone: formData.phone,
      two_fa_enabled: formData.two_fa_enabled,
      billing_address: formData.billing_address,
      billing_city: formData.billing_city,
      billing_postal_code: formData.billing_postal_code,
      billing_country: formData.billing_country,
      vat_number: formData.vat_number
    });
    
    // If 2FA is being disabled, clear session
    if (!formData.two_fa_enabled && user?.two_fa_enabled) {
      sessionStorage.removeItem('2fa_session_id');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedUserId(true);
    setTimeout(() => setCopiedUserId(false), 2000);
  };

  const getInitials = (name) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Account Instellingen</h1>
          <p className="text-gray-500">Beheer je persoonlijke gegevens en voorkeuren</p>
        </div>

        <div className="grid gap-6">
          <Card className="border-none shadow-lg">
            <CardHeader className="border-b border-gray-100">
              <CardTitle>Profielfoto</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-center gap-6">
                <Avatar className="w-24 h-24 border-4 border-indigo-100">
                  <AvatarImage src={formData.avatar_url} />
                  <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-2xl font-semibold">
                    {getInitials(formData.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <label htmlFor="avatar-upload">
                    <Button asChild disabled={uploadingAvatar} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white">
                      <span className="cursor-pointer">
                        <Upload className="w-4 h-4 mr-2" />
                        {uploadingAvatar ? "Uploaden..." : "Foto Uploaden"}
                      </span>
                    </Button>
                  </label>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    JPG, PNG of GIF (max. 5MB)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg">
            <CardHeader className="border-b border-gray-100">
              <CardTitle>Persoonlijke Informatie</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="user_id">User ID</Label>
                  <div className="relative mt-2">
                    <Input
                      id="user_id"
                      value={user?.id || ""}
                      disabled
                      className="bg-gray-50 pr-10"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => copyToClipboard(user?.id || "")}
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                    >
                      {copiedUserId ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-400" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {copiedUserId ? "✓ Gekopieerd!" : "Gebruik dit ID om toegang te delen"}
                  </p>
                </div>

                <div>
                  <Label htmlFor="full_name">Volledige Naam</Label>
                  <div className="relative mt-2">
                    <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <Input
                      id="full_name"
                      value={formData.full_name}
                      disabled
                      className="pl-10 bg-gray-50"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Naam kan niet worden gewijzigd
                  </p>
                </div>

                <div>
                  <Label htmlFor="email">E-mailadres</Label>
                  <div className="relative mt-2">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      disabled
                      className="pl-10 bg-gray-50"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    E-mail kan niet worden gewijzigd
                  </p>
                </div>

                <div>
                  <Label htmlFor="company">Bedrijf</Label>
                  <div className="relative mt-2">
                    <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <Input
                      id="company"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      placeholder="Bedrijfsnaam"
                      className="pl-10"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="phone">Telefoonnummer</Label>
                  <div className="relative mt-2">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+31 6 12345678"
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-4 border-t border-gray-100 mt-6">
                <Button 
                  onClick={handleSave}
                  disabled={updateUserMutation.isPending}
                  className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                >
                  {saved ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Opgeslagen
                    </>
                  ) : (
                    "Persoonlijke Gegevens Opslaan"
                  )}
                </Button>
                {saved && (
                  <p className="text-sm text-green-600">
                    Je persoonlijke gegevens zijn succesvol opgeslagen
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg">
            <CardHeader className="border-b border-gray-100">
              <CardTitle>Factuurgegevens</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <Label htmlFor="billing_address">Adres</Label>
                  <Input
                    id="billing_address"
                    value={formData.billing_address}
                    onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
                    placeholder="Straatnaam en huisnummer"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="billing_city">Stad</Label>
                  <Input
                    id="billing_city"
                    value={formData.billing_city}
                    onChange={(e) => setFormData({ ...formData, billing_city: e.target.value })}
                    placeholder="Amsterdam"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="billing_postal_code">Postcode</Label>
                  <Input
                    id="billing_postal_code"
                    value={formData.billing_postal_code}
                    onChange={(e) => setFormData({ ...formData, billing_postal_code: e.target.value })}
                    placeholder="1234 AB"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="billing_country">Land</Label>
                  <select
                    id="billing_country"
                    value={formData.billing_country}
                    onChange={(e) => setFormData({ ...formData, billing_country: e.target.value })}
                    className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="NL">Nederland</option>
                    <option value="BE">België</option>
                    <option value="DE">Duitsland</option>
                    <option value="FR">Frankrijk</option>
                    <option value="GB">Verenigd Koninkrijk</option>
                    <option value="US">Verenigde Staten</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="vat_number">BTW-nummer (optioneel)</Label>
                  <Input
                    id="vat_number"
                    value={formData.vat_number}
                    onChange={(e) => setFormData({ ...formData, vat_number: e.target.value.toUpperCase() })}
                    placeholder="NL123456789B01"
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Voor zakelijke klanten binnen de EU
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-4 border-t border-gray-100 mt-6">
                <Button 
                  onClick={handleSave}
                  disabled={updateUserMutation.isPending}
                  className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                >
                  {saved ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Opgeslagen
                    </>
                  ) : (
                    "Factureringsgegevens Opslaan"
                  )}
                </Button>
                {saved && (
                  <p className="text-sm text-green-600">
                    Je factureringsgegevens zijn succesvol opgeslagen
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg">
            <CardHeader className="border-b border-gray-100">
              <CardTitle>Beveiliging</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="w-5 h-5 text-indigo-600" />
                    <Label htmlFor="two_fa_enabled" className="text-base font-semibold cursor-pointer">
                      Twee-Factor Authenticatie (2FA)
                    </Label>
                  </div>
                  <p className="text-sm text-gray-600">
                    Verhoog de beveiliging van je account met een extra verificatiestap via email
                  </p>
                  {formData.two_fa_enabled && (
                    <div className="mt-2">
                      <Badge className="bg-green-100 text-green-700 border-green-200">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Actief
                      </Badge>
                    </div>
                  )}
                </div>
                <Switch
                  id="two_fa_enabled"
                  checked={formData.two_fa_enabled}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, two_fa_enabled: checked })
                  }
                />
              </div>

              {formData.two_fa_enabled !== user?.two_fa_enabled && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    {formData.two_fa_enabled 
                      ? "⚠️ Als je 2FA inschakelt, moet je bij elke login een verificatiecode invoeren die naar je email wordt gestuurd."
                      : "⚠️ Als je 2FA uitschakelt, is je account minder goed beschermd tegen ongeautoriseerde toegang."
                    }
                  </p>
                </div>
              )}

              <div className="flex items-center gap-3 pt-4 border-t border-gray-100 mt-4">
                <Button 
                  onClick={handleSave}
                  disabled={updateUserMutation.isPending}
                  className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                >
                  {saved ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Opgeslagen
                    </>
                  ) : (
                    "Wijzigingen Opslaan"
                  )}
                </Button>
                {saved && (
                  <p className="text-sm text-green-600">
                    Je wijzigingen zijn succesvol opgeslagen
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
