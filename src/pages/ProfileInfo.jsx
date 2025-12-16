import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Mail,
  Building,
  Crown,
  Calendar,
  Upload,
  Loader2,
  Save,
  Copy,
  CheckCircle
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { useUser } from "../Layout";

export default function ProfileInfo() {
  const user = useUser();
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    company: "",
    phone: ""
  });
  const [copiedId, setCopiedId] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || "",
        company: user.company || "",
        phone: user.phone || ""
      });
    }
  }, [user]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data) => {
      await base44.auth.updateMe(data);
      const updatedUser = await base44.auth.me();
      return updatedUser;
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      setIsEditing(false);
      toast({
        title: "Profiel bijgewerkt",
        description: "Je profielinformatie is succesvol bijgewerkt",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Fout bij bijwerken",
        description: error.message,
      });
    }
  });

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const uploadResult = await base44.integrations.Core.UploadFile({ file });
      await base44.auth.updateMe({ avatar_url: uploadResult.file_url });
      queryClient.invalidateQueries();
      toast({
        title: "Avatar bijgewerkt",
        description: "Je profielfoto is succesvol bijgewerkt",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Upload mislukt",
        description: error.message,
      });
    }
    setUploadingAvatar(false);
  };

  const handleSave = () => {
    updateProfileMutation.mutate(formData);
  };

  const handleCopyId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
      toast({
        title: "ID gekopieerd",
        description: "Je gebruikers-ID is gekopieerd naar het klembord",
      });
    }
  };

  const getInitials = (name) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-full">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 bg-gray-50 min-h-full">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Mijn Profiel</h1>
          <p className="text-gray-600">Beheer je persoonlijke informatie</p>
        </div>

        {/* Profile Picture Card */}
        <Card className="border-none shadow-md mb-6">
          <CardHeader className="border-b border-gray-100">
            <CardTitle>Profielfoto</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex items-center gap-6">
              <Avatar className="w-24 h-24 border-4 border-gray-200">
                <AvatarImage src={user.avatar_url} />
                <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-semibold text-2xl">
                  {getInitials(user.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 mb-2">Upload nieuwe foto</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Aanbevolen: vierkant formaat, minimaal 200x200 pixels
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => document.getElementById('avatar-upload').click()}
                    disabled={uploadingAvatar}
                    size="sm"
                    variant="outline"
                  >
                    {uploadingAvatar ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploaden...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Kies Foto
                      </>
                    )}
                  </Button>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Personal Information Card */}
        <Card className="border-none shadow-md mb-6">
          <CardHeader className="border-b border-gray-100">
            <div className="flex items-center justify-between">
              <CardTitle>Persoonlijke Informatie</CardTitle>
              {!isEditing ? (
                <Button
                  onClick={() => setIsEditing(true)}
                  size="sm"
                  variant="outline"
                >
                  Bewerken
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    onClick={handleSave}
                    disabled={updateProfileMutation.isPending}
                    size="sm"
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                  >
                    {updateProfileMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Opslaan...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Opslaan
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => {
                      setIsEditing(false);
                      setFormData({
                        full_name: user.full_name || "",
                        company: user.company || "",
                        phone: user.phone || ""
                      });
                    }}
                    size="sm"
                    variant="outline"
                  >
                    Annuleren
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="full_name" className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-gray-500" />
                    Volledige Naam
                  </Label>
                  {isEditing ? (
                    <Input
                      id="full_name"
                      value={formData.full_name}
                      onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                    />
                  ) : (
                    <p className="text-gray-900 font-medium">{user.full_name || "-"}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="email" className="flex items-center gap-2 mb-2">
                    <Mail className="w-4 h-4 text-gray-500" />
                    E-mailadres
                  </Label>
                  <p className="text-gray-900 font-medium">{user.email}</p>
                  <p className="text-xs text-gray-500 mt-1">E-mailadres kan niet worden gewijzigd</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="company" className="flex items-center gap-2 mb-2">
                    <Building className="w-4 h-4 text-gray-500" />
                    Bedrijf
                  </Label>
                  {isEditing ? (
                    <Input
                      id="company"
                      value={formData.company}
                      onChange={(e) => setFormData({...formData, company: e.target.value})}
                      placeholder="Je bedrijfsnaam"
                    />
                  ) : (
                    <p className="text-gray-900 font-medium">{user.company || "-"}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="phone" className="flex items-center gap-2 mb-2">
                    <Mail className="w-4 h-4 text-gray-500" />
                    Telefoonnummer
                  </Label>
                  {isEditing ? (
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      placeholder="+31 6 12345678"
                    />
                  ) : (
                    <p className="text-gray-900 font-medium">{user.phone || "-"}</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Details Card */}
        <Card className="border-none shadow-md">
          <CardHeader className="border-b border-gray-100">
            <CardTitle>Account Details</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <Label className="text-sm text-gray-600 mb-1">Gebruikers-ID</Label>
                  <p className="text-sm font-mono text-gray-900">{user.id}</p>
                </div>
                <Button
                  onClick={handleCopyId}
                  size="sm"
                  variant="outline"
                >
                  {copiedId ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                      Gekopieerd
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Kopiëren
                    </>
                  )}
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <Label className="text-sm text-gray-600 mb-1">Account Type</Label>
                  <div className="flex items-center gap-2">
                    {user.role === "admin" ? (
                      <Badge className="bg-purple-100 text-purple-700">
                        <Crown className="w-3 h-3 mr-1" />
                        Administrator
                      </Badge>
                    ) : (
                      <Badge className="bg-blue-100 text-blue-700">
                        <User className="w-3 h-3 mr-1" />
                        Gebruiker
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <Label className="text-sm text-gray-600 mb-1">Lid sinds</Label>
                  <div className="flex items-center gap-2 text-sm text-gray-900">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(user.created_date), "d MMMM yyyy", { locale: nl })}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}