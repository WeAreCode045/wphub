import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign,
  CreditCard,
  Tag,
  Settings,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  Percent,
  Calendar,
  Users,
  TrendingUp,
  Upload
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

export default function FinanceSettings() {
  const [user, setUser] = useState(null);
  const [showDiscountDialog, setShowDiscountDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [editingDiscount, setEditingDiscount] = useState(null);
  const [invoiceSettings, setInvoiceSettings] = useState({
    vat_rate: "21",
    vat_number: "",
    company_name: "",
    company_address: "",
    company_details: "",
    logo_url: "",
    invoice_footer: "",
    accent_color: "#6366f1",
    item_background_color: "#f9fafb",
    text_color: "#111827"
  });
  const [discountForm, setDiscountForm] = useState({
    code: "",
    description: "",
    discount_type: "percentage",
    percentage_off: 0,
    amount_off: 0,
    currency: "EUR",
    applies_to_plans: [],
    duration: "once",
    duration_in_months: 1,
    max_redemptions: null,
    is_active: true,
    valid_from: "",
    expires_at: ""
  });
  
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
    if (currentUser?.role !== "admin") {
      navigate(createPageUrl("Dashboard"));
    }
  };

  const { data: discounts = [] } = useQuery({
    queryKey: ['discount-codes'],
    queryFn: () => base44.entities.DiscountCode.list("-created_date"),
    enabled: !!user && user.role === "admin",
    initialData: [],
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: () => base44.entities.SubscriptionPlan.list(),
    enabled: !!user && user.role === "admin",
    initialData: [],
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user && user.role === "admin",
    initialData: [],
  });

  const { data: allSubscriptions = [] } = useQuery({
    queryKey: ['all-subscriptions'],
    queryFn: () => base44.entities.UserSubscription.list(),
    enabled: !!user && user.role === "admin",
    initialData: [],
  });

  const { data: invoiceSettingsData } = useQuery({
    queryKey: ['invoice-settings'],
    queryFn: async () => {
      const settings = await base44.entities.SiteSettings.list();
      return {
        vat_rate: settings.find(s => s.setting_key === 'invoice_vat_rate')?.setting_value || "21",
        vat_number: settings.find(s => s.setting_key === 'invoice_vat_number')?.setting_value || "",
        company_name: settings.find(s => s.setting_key === 'invoice_company_name')?.setting_value || "",
        company_address: settings.find(s => s.setting_key === 'invoice_company_address')?.setting_value || "",
        company_details: settings.find(s => s.setting_key === 'invoice_company_details')?.setting_value || "",
        logo_url: settings.find(s => s.setting_key === 'invoice_logo_url')?.setting_value || "",
        invoice_footer: settings.find(s => s.setting_key === 'invoice_footer')?.setting_value || "",
        accent_color: settings.find(s => s.setting_key === 'invoice_accent_color')?.setting_value || "#6366f1",
        item_background_color: settings.find(s => s.setting_key === 'invoice_item_bg_color')?.setting_value || "#f9fafb",
        text_color: settings.find(s => s.setting_key === 'invoice_text_color')?.setting_value || "#111827"
      };
    },
    enabled: !!user && user.role === "admin",
    onSuccess: (data) => {
      setInvoiceSettings(data);
    }
  });

  const createDiscountMutation = useMutation({
    mutationFn: (data) => base44.entities.DiscountCode.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discount-codes'] });
      setShowDiscountDialog(false);
      resetForm();
    }
  });

  const updateDiscountMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DiscountCode.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discount-codes'] });
      setShowDiscountDialog(false);
      resetForm();
    }
  });

  const deleteDiscountMutation = useMutation({
    mutationFn: (id) => base44.entities.DiscountCode.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discount-codes'] });
    }
  });

  const importInvoicesMutation = useMutation({
    mutationFn: async (userId) => {
      const response = await base44.functions.invoke('importStripeInvoices', {
        user_id: userId
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setShowImportDialog(false);
      setSelectedUserId("");
      alert(`✅ ${data.message}\n\nGeïmporteerd: ${data.imported}\nOvergeslagen: ${data.skipped}`);
    },
    onError: (error) => {
      alert('❌ Import mislukt: ' + (error.response?.data?.error || error.message));
    }
  });

  const saveInvoiceSettingsMutation = useMutation({
    mutationFn: async (settings) => {
      const settingsToSave = [
        { key: 'invoice_vat_rate', value: settings.vat_rate, description: 'BTW percentage voor facturen' },
        { key: 'invoice_vat_number', value: settings.vat_number, description: 'BTW nummer' },
        { key: 'invoice_company_name', value: settings.company_name, description: 'Bedrijfsnaam op facturen' },
        { key: 'invoice_company_address', value: settings.company_address, description: 'Factuuradres' },
        { key: 'invoice_company_details', value: settings.company_details, description: 'Bedrijfsgegevens voor factuur' },
        { key: 'invoice_logo_url', value: settings.logo_url, description: 'Logo URL voor factuur' },
        { key: 'invoice_footer', value: settings.invoice_footer, description: 'Voettekst factuur' },
        { key: 'invoice_accent_color', value: settings.accent_color, description: 'Accentkleur factuur' },
        { key: 'invoice_item_bg_color', value: settings.item_background_color, description: 'Achtergrondkleur factuuritems' },
        { key: 'invoice_text_color', value: settings.text_color, description: 'Tekstkleur factuur' }
      ];

      const existingSettings = await base44.entities.SiteSettings.list();
      
      for (const setting of settingsToSave) {
        const existing = existingSettings.find(s => s.setting_key === setting.key);
        if (existing) {
          await base44.entities.SiteSettings.update(existing.id, {
            setting_value: setting.value,
            description: setting.description
          });
        } else {
          await base44.entities.SiteSettings.create({
            setting_key: setting.key,
            setting_value: setting.value,
            description: setting.description
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-settings'] });
      alert('✅ Factuurinstellingen opgeslagen');
    },
    onError: (error) => {
      alert('❌ Opslaan mislukt: ' + error.message);
    }
  });

  const resetForm = () => {
    setEditingDiscount(null);
    setDiscountForm({
      code: "",
      description: "",
      discount_type: "percentage",
      percentage_off: 0,
      amount_off: 0,
      currency: "EUR",
      applies_to_plans: [],
      duration: "once",
      duration_in_months: 1,
      max_redemptions: null,
      is_active: true,
      valid_from: "",
      expires_at: ""
    });
  };

  const handleEditDiscount = (discount) => {
    setEditingDiscount(discount);
    setDiscountForm({
      code: discount.code,
      description: discount.description || "",
      discount_type: discount.discount_type,
      percentage_off: discount.percentage_off || 0,
      amount_off: discount.amount_off || 0,
      currency: discount.currency || "EUR",
      applies_to_plans: discount.applies_to_plans || [],
      duration: discount.duration,
      duration_in_months: discount.duration_in_months || 1,
      max_redemptions: discount.max_redemptions,
      is_active: discount.is_active,
      valid_from: discount.valid_from || "",
      expires_at: discount.expires_at || ""
    });
    setShowDiscountDialog(true);
  };

  const handleSubmit = () => {
    const data = {
      ...discountForm,
      created_by: user.email
    };

    if (editingDiscount) {
      updateDiscountMutation.mutate({ id: editingDiscount.id, data });
    } else {
      createDiscountMutation.mutate(data);
    }
  };

  const togglePlan = (planId) => {
    const current = discountForm.applies_to_plans || [];
    if (current.includes(planId)) {
      setDiscountForm({
        ...discountForm,
        applies_to_plans: current.filter(id => id !== planId)
      });
    } else {
      setDiscountForm({
        ...discountForm,
        applies_to_plans: [...current, planId]
      });
    }
  };

  const stats = {
    total: discounts.length,
    active: discounts.filter(d => d.is_active).length,
    used: discounts.reduce((sum, d) => sum + (d.times_redeemed || 0), 0)
  };

  if (!user || user.role !== "admin") {
    return null;
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Financiële Instellingen</h1>
          <p className="text-sm text-gray-600">Beheer Stripe integratie, kortingscodes en BTW instellingen</p>
        </div>

        <Tabs defaultValue="discounts" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="discounts">Kortingscodes</TabsTrigger>
            <TabsTrigger value="stripe">Stripe Instellingen</TabsTrigger>
            <TabsTrigger value="vat">BTW & Facturatie</TabsTrigger>
          </TabsList>

          {/* Discount Codes Tab */}
          <TabsContent value="discounts" className="space-y-6">
            {/* Stats */}
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="border-none shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Totaal Codes</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                    </div>
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-lg flex items-center justify-center">
                      <Tag className="w-5 h-5 text-indigo-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Actieve Codes</p>
                      <p className="text-2xl font-bold text-green-600">{stats.active}</p>
                    </div>
                    <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-green-200 rounded-lg flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Keer Gebruikt</p>
                      <p className="text-2xl font-bold text-purple-600">{stats.used}</p>
                    </div>
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Add Button */}
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  resetForm();
                  setShowDiscountDialog(true);
                }}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nieuwe Kortingscode
              </Button>
            </div>

            {/* Discounts List */}
            <div className="space-y-3">
              {discounts.map(discount => (
                <Card key={discount.id} className="border-none shadow-md hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Tag className="w-5 h-5 text-purple-600" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-bold text-gray-900">{discount.code}</h3>
                          <Badge className={discount.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
                            {discount.is_active ? "Actief" : "Inactief"}
                          </Badge>
                          {discount.discount_type === "percentage" ? (
                            <Badge variant="outline" className="text-xs">
                              <Percent className="w-3 h-3 mr-1" />
                              {discount.percentage_off}%
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              <DollarSign className="w-3 h-3 mr-1" />
                              €{(discount.amount_off / 100).toFixed(2)}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-600">
                          <span>{discount.description || "Geen beschrijving"}</span>
                          {discount.max_redemptions && (
                            <>
                              <span>•</span>
                              <span>{discount.times_redeemed || 0}/{discount.max_redemptions} gebruikt</span>
                            </>
                          )}
                          {discount.expires_at && (
                            <>
                              <span>•</span>
                              <span>Verloopt: {format(new Date(discount.expires_at), "d MMM yyyy", { locale: nl })}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditDiscount(discount)}
                          className="h-8 w-8"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm(`Weet je zeker dat je kortingscode "${discount.code}" wilt verwijderen?`)) {
                              deleteDiscountMutation.mutate(discount.id);
                            }
                          }}
                          className="h-8 w-8 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {discounts.length === 0 && (
              <Card className="border-none shadow-md">
                <CardContent className="p-12 text-center">
                  <Tag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-gray-900 mb-1">Nog geen kortingscodes</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Maak je eerste kortingscode aan om klanten korting te bieden
                  </p>
                  <Button
                    onClick={() => {
                      resetForm();
                      setShowDiscountDialog(true);
                    }}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Nieuwe Kortingscode
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Stripe Settings Tab */}
          <TabsContent value="stripe" className="space-y-6">
            <Card className="border-none shadow-md">
              <CardHeader>
                <CardTitle className="text-lg">Stripe Configuratie</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <h4 className="font-semibold text-green-900">Stripe Verbonden</h4>
                  </div>
                  <p className="text-sm text-green-700">
                    Je Stripe account is succesvol gekoppeld. Betalingen worden automatisch verwerkt.
                  </p>
                </div>

                <div>
                  <Label>Stripe Dashboard</Label>
                  <Button
                    variant="outline"
                    className="w-full mt-2"
                    onClick={() => window.open('https://dashboard.stripe.com', '_blank')}
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Open Stripe Dashboard
                  </Button>
                </div>

                <div>
                  <Label>Webhook Status</Label>
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm">
                    <p className="text-gray-700">Webhooks zijn actief en ontvangen events van Stripe</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* VAT & Invoicing Tab */}
          <TabsContent value="vat" className="space-y-6">
            <Card className="border-none shadow-md">
              <CardHeader>
                <CardTitle className="text-lg">BTW & Bedrijfsinformatie</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Standaard BTW Tarief (%)</Label>
                    <Input
                      type="number"
                      placeholder="21"
                      className="mt-2"
                      value={invoiceSettings.vat_rate}
                      onChange={(e) => setInvoiceSettings({...invoiceSettings, vat_rate: e.target.value})}
                    />
                    <p className="text-xs text-gray-600 mt-1">Percentage BTW (bijv. 21 voor 21%)</p>
                  </div>

                  <div>
                    <Label>BTW Nummer</Label>
                    <Input
                      placeholder="NL123456789B01"
                      className="mt-2"
                      value={invoiceSettings.vat_number}
                      onChange={(e) => setInvoiceSettings({...invoiceSettings, vat_number: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <Label>Bedrijfsnaam op facturen</Label>
                  <Input
                    placeholder="Jouw Bedrijfsnaam B.V."
                    className="mt-2"
                    value={invoiceSettings.company_name}
                    onChange={(e) => setInvoiceSettings({...invoiceSettings, company_name: e.target.value})}
                  />
                </div>

                <div>
                  <Label>Factuuradres</Label>
                  <Textarea
                    placeholder="Straatnaam 123&#10;1234 AB Stad&#10;Nederland"
                    className="mt-2"
                    rows={3}
                    value={invoiceSettings.company_address}
                    onChange={(e) => setInvoiceSettings({...invoiceSettings, company_address: e.target.value})}
                  />
                </div>

                <div>
                  <Label>Uitgebreide Bedrijfsgegevens</Label>
                  <Textarea
                    placeholder="KVK-nummer: 12345678&#10;Rekeningnummer: NL00 BANK 0000 0000 00&#10;Extra informatie..."
                    className="mt-2"
                    rows={4}
                    value={invoiceSettings.company_details}
                    onChange={(e) => setInvoiceSettings({...invoiceSettings, company_details: e.target.value})}
                  />
                  <p className="text-xs text-gray-600 mt-1">Aanvullende bedrijfsgegevens die op de factuur worden weergegeven</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md">
              <CardHeader>
                <CardTitle className="text-lg">Factuur Layout & Styling</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Logo URL</Label>
                  <Input
                    placeholder="https://voorbeeld.nl/logo.png"
                    className="mt-2"
                    value={invoiceSettings.logo_url}
                    onChange={(e) => setInvoiceSettings({...invoiceSettings, logo_url: e.target.value})}
                  />
                  <p className="text-xs text-gray-600 mt-1">URL van je bedrijfslogo dat bovenaan de factuur verschijnt</p>
                </div>

                <div>
                  <Label>Factuur Voettekst</Label>
                  <Textarea
                    placeholder="Bedankt voor uw vertrouwen!&#10;Betaling binnen 14 dagen.&#10;Zie onze algemene voorwaarden op www.voorbeeld.nl"
                    className="mt-2"
                    rows={3}
                    value={invoiceSettings.invoice_footer}
                    onChange={(e) => setInvoiceSettings({...invoiceSettings, invoice_footer: e.target.value})}
                  />
                  <p className="text-xs text-gray-600 mt-1">Tekst die onderaan de factuur wordt weergegeven</p>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <Label>Accentkleur</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        type="color"
                        value={invoiceSettings.accent_color}
                        onChange={(e) => setInvoiceSettings({...invoiceSettings, accent_color: e.target.value})}
                        className="w-16 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        placeholder="#6366f1"
                        value={invoiceSettings.accent_color}
                        onChange={(e) => setInvoiceSettings({...invoiceSettings, accent_color: e.target.value})}
                        className="flex-1"
                      />
                    </div>
                    <p className="text-xs text-gray-600 mt-1">Kleur voor headers en lijnen</p>
                  </div>

                  <div>
                    <Label>Achtergrond Factuuritems</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        type="color"
                        value={invoiceSettings.item_background_color}
                        onChange={(e) => setInvoiceSettings({...invoiceSettings, item_background_color: e.target.value})}
                        className="w-16 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        placeholder="#f9fafb"
                        value={invoiceSettings.item_background_color}
                        onChange={(e) => setInvoiceSettings({...invoiceSettings, item_background_color: e.target.value})}
                        className="flex-1"
                      />
                    </div>
                    <p className="text-xs text-gray-600 mt-1">Achtergrondkleur items</p>
                  </div>

                  <div>
                    <Label>Tekstkleur</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        type="color"
                        value={invoiceSettings.text_color}
                        onChange={(e) => setInvoiceSettings({...invoiceSettings, text_color: e.target.value})}
                        className="w-16 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        placeholder="#111827"
                        value={invoiceSettings.text_color}
                        onChange={(e) => setInvoiceSettings({...invoiceSettings, text_color: e.target.value})}
                        className="flex-1"
                      />
                    </div>
                    <p className="text-xs text-gray-600 mt-1">Primaire tekstkleur</p>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <Button
                    onClick={() => saveInvoiceSettingsMutation.mutate(invoiceSettings)}
                    disabled={saveInvoiceSettingsMutation.isPending}
                    className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                  >
                    {saveInvoiceSettingsMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Opslaan...
                      </>
                    ) : (
                      "Factuurinstellingen Opslaan"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Import Stripe Invoices */}
            <Card className="border-none shadow-md">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Upload className="w-5 h-5 text-indigo-600" />
                  Historische Facturen Importeren
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600">
                  Importeer historische facturen uit Stripe voor gebruikers met bestaande abonnementen. Dit is handig voor het importeren van facturen die zijn aangemaakt voordat de automatische facturatie werd ingeschakeld.
                </p>
                <Button
                  onClick={() => setShowImportDialog(true)}
                  variant="outline"
                  className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Facturen Importeren
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Discount Dialog */}
        <Dialog open={showDiscountDialog} onOpenChange={setShowDiscountDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingDiscount ? "Kortingscode Bewerken" : "Nieuwe Kortingscode"}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 mt-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Code *</Label>
                  <Input
                    placeholder="SUMMER2024"
                    value={discountForm.code}
                    onChange={(e) => setDiscountForm({...discountForm, code: e.target.value.toUpperCase()})}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Type Korting *</Label>
                  <Select
                    value={discountForm.discount_type}
                    onValueChange={(value) => setDiscountForm({...discountForm, discount_type: value})}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed_amount">Vast Bedrag</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Beschrijving</Label>
                <Input
                  placeholder="Zomer promotie 2024"
                  value={discountForm.description}
                  onChange={(e) => setDiscountForm({...discountForm, description: e.target.value})}
                  className="mt-1"
                />
              </div>

              {discountForm.discount_type === "percentage" ? (
                <div>
                  <Label>Percentage Korting *</Label>
                  <Input
                    type="number"
                    placeholder="20"
                    value={discountForm.percentage_off}
                    onChange={(e) => setDiscountForm({...discountForm, percentage_off: parseInt(e.target.value) || 0})}
                    className="mt-1"
                  />
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Bedrag (in centen) *</Label>
                    <Input
                      type="number"
                      placeholder="1000"
                      value={discountForm.amount_off}
                      onChange={(e) => setDiscountForm({...discountForm, amount_off: parseInt(e.target.value) || 0})}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Valuta</Label>
                    <Select
                      value={discountForm.currency}
                      onValueChange={(value) => setDiscountForm({...discountForm, currency: value})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Duur</Label>
                  <Select
                    value={discountForm.duration}
                    onValueChange={(value) => setDiscountForm({...discountForm, duration: value})}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="once">Eenmalig</SelectItem>
                      <SelectItem value="repeating">Herhalend</SelectItem>
                      <SelectItem value="forever">Voor Altijd</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {discountForm.duration === "repeating" && (
                  <div>
                    <Label>Aantal Maanden</Label>
                    <Input
                      type="number"
                      value={discountForm.duration_in_months}
                      onChange={(e) => setDiscountForm({...discountForm, duration_in_months: parseInt(e.target.value) || 1})}
                      className="mt-1"
                    />
                  </div>
                )}
              </div>

              <div>
                <Label className="mb-2 block">Geldig voor plannen</Label>
                <div className="grid md:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-3 bg-gray-50 rounded-lg">
                  {plans.length === 0 ? (
                    <p className="text-sm text-gray-600 col-span-2">Geen plannen beschikbaar</p>
                  ) : (
                    plans.map(plan => (
                      <div
                        key={plan.id}
                        onClick={() => togglePlan(plan.id)}
                        className={`p-2 border-2 rounded-lg cursor-pointer transition-all text-sm ${
                          discountForm.applies_to_plans?.includes(plan.id)
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                            discountForm.applies_to_plans?.includes(plan.id)
                              ? 'border-indigo-500 bg-indigo-500'
                              : 'border-gray-300'
                          }`}>
                            {discountForm.applies_to_plans?.includes(plan.id) && (
                              <span className="text-white text-xs">✓</span>
                            )}
                          </div>
                          <span>{plan.name}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Laat leeg om op alle plannen van toepassing te zijn
                </p>
              </div>

              <div>
                <Label>Max. aantal gebruik (optioneel)</Label>
                <Input
                  type="number"
                  placeholder="Onbeperkt"
                  value={discountForm.max_redemptions || ""}
                  onChange={(e) => setDiscountForm({...discountForm, max_redemptions: e.target.value ? parseInt(e.target.value) : null})}
                  className="mt-1"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <Label>Kortingscode Actief</Label>
                  <p className="text-xs text-gray-600">De code kan worden gebruikt door klanten</p>
                </div>
                <Switch
                  checked={discountForm.is_active}
                  onCheckedChange={(checked) => setDiscountForm({...discountForm, is_active: checked})}
                />
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={handleSubmit}
                  disabled={!discountForm.code || createDiscountMutation.isPending || updateDiscountMutation.isPending}
                  className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                >
                  {createDiscountMutation.isPending || updateDiscountMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Opslaan...
                    </>
                  ) : (
                    editingDiscount ? "Bijwerken" : "Aanmaken"
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDiscountDialog(false)}
                >
                  Annuleren
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Import Invoices Dialog */}
        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-indigo-600" />
                Stripe Facturen Importeren
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              <p className="text-sm text-gray-600">
                Importeer historische facturen uit Stripe voor een specifieke gebruiker. Alleen facturen die nog niet in het systeem staan worden geïmporteerd.
              </p>

              <div>
                <Label htmlFor="user-select">Selecteer Gebruiker</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger id="user-select" className="mt-2">
                    <SelectValue placeholder="Kies een gebruiker..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allUsers
                      .filter(u => allSubscriptions.some(sub => sub.user_id === u.id && sub.stripe_customer_id))
                      .map(u => (
                        <SelectItem key={u.id} value={u.id}>
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-gray-400" />
                            <span>{u.full_name} ({u.email})</span>
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-2">
                  Alleen gebruikers met een Stripe Customer ID worden getoond
                </p>
              </div>

              {selectedUserId && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <p className="text-sm text-blue-900">
                    <strong>Let op:</strong> Dit importeert alle betaalde en openstaande facturen uit Stripe voor deze gebruiker. Bestaande facturen worden overgeslagen.
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowImportDialog(false);
                    setSelectedUserId("");
                  }}
                  className="flex-1"
                >
                  Annuleren
                </Button>
                <Button
                  onClick={() => importInvoicesMutation.mutate(selectedUserId)}
                  disabled={!selectedUserId || importInvoicesMutation.isPending}
                  className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                >
                  {importInvoicesMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importeren...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Importeren
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}