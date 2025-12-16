import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Package,
  Palette,
  Plus,
  Edit,
  Trash2,
  Star,
  Crown,
  Loader2,
  CheckCircle,
  XCircle,
  DollarSign,
  Sparkles,
  Layers,
  Copy,
  Calendar,
  Users,
  Eye,
  EyeOff,
  Globe,
  Briefcase,
  Infinity
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useUser } from "../Layout";

export default function SubscriptionPlans() {
  const user = useUser();
  const [showDialog, setShowDialog] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    group_id: "",
    stripe_product_id: "",
    stripe_price_id_monthly: "",
    stripe_price_id_annual: "",
    monthly_price_amount: 0,
    annual_price_amount: 0,
    currency: "EUR",
    features: {
      plugins: { enabled: false, limit: 0 },
      themes: { enabled: false, limit: 0 },
      sites: { enabled: false, limit: 0 },
      projects: { enabled: false, limit: 0 },
      teams: { enabled: false, limit: 0 }
    },
    vat_rate_percentage: 21,
    trial_days: 14,
    is_active: true,
    is_highlighted: false,
    highlight_label: "",
    annual_discount_percentage: 0,
    sort_order: 0
  });

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (user && user.role !== "admin") {
      navigate(createPageUrl("Dashboard"));
    }
  }, [user, navigate]);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['admin-subscription-plans'],
    queryFn: async () => {
      if (!user || user.role !== 'admin') return [];
      const allPlans = await base44.entities.SubscriptionPlan.list("sort_order");
      return allPlans;
    },
    enabled: !!user && user.role === "admin",
    staleTime: 0,
    initialData: [],
  });

  const { data: planGroups = [] } = useQuery({
    queryKey: ['admin-plan-groups'],
    queryFn: async () => {
      if (!user || user.role !== 'admin') return [];
      const groups = await base44.entities.PlanGroup.list("sort_order");
      return groups;
    },
    enabled: !!user && user.role === "admin",
    staleTime: 0,
    initialData: [],
  });

  const createPlanMutation = useMutation({
    mutationFn: async (planData) => {
      return base44.entities.SubscriptionPlan.create(planData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscription-plans'] });
      setShowDialog(false);
      resetForm();
      toast({
        title: "Plan aangemaakt",
        description: "Het abonnementsplan is succesvol aangemaakt",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Fout bij aanmaken",
        description: error.message,
      });
    }
  });

  const updatePlanMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      return base44.entities.SubscriptionPlan.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscription-plans'] });
      setShowDialog(false);
      resetForm();
      toast({
        title: "Plan bijgewerkt",
        description: "Het abonnementsplan is succesvol bijgewerkt",
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

  const deletePlanMutation = useMutation({
    mutationFn: (planId) => base44.entities.SubscriptionPlan.delete(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscription-plans'] });
      toast({
        title: "Plan verwijderd",
        description: "Het abonnementsplan is succesvol verwijderd",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Fout bij verwijderen",
        description: error.message,
      });
    }
  });

  const copyPlanMutation = useMutation({
    mutationFn: async (plan) => {
      const copiedPlan = {
        name: `${plan.name} (kopie)`,
        description: plan.description,
        group_id: plan.group_id,
        stripe_product_id: "",
        stripe_price_id_monthly: "",
        stripe_price_id_annual: "",
        monthly_price_amount: plan.monthly_price_amount,
        annual_price_amount: plan.annual_price_amount,
        currency: plan.currency,
        features: { ...plan.features },
        vat_rate_percentage: plan.vat_rate_percentage,
        trial_days: plan.trial_days,
        is_active: false,
        is_highlighted: false,
        highlight_label: plan.highlight_label,
        annual_discount_percentage: plan.annual_discount_percentage,
        sort_order: plan.sort_order + 1
      };

      return base44.entities.SubscriptionPlan.create(copiedPlan);
    },
    onSuccess: (newPlan) => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscription-plans'] });
      toast({
        title: "Plan gekopieerd",
        description: `"${newPlan.name}" is aangemaakt. Maak nu Stripe product en prijzen aan.`,
      });
      handleEdit(newPlan);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Fout bij kopiëren",
        description: error.message,
      });
    }
  });

  const handleCreateStripeProduct = async () => {
    if (!formData.name) {
      toast({
        variant: "destructive",
        title: "Naam verplicht",
        description: "Voer een naam in voor het plan",
      });
      return;
    }

    setIsCreatingProduct(true);
    try {
      const productResponse = await base44.functions.invoke('createStripeProduct', {
        name: formData.name,
        description: formData.description
      });

      if (!productResponse.data.success) {
        throw new Error(productResponse.data.error);
      }

      const productId = productResponse.data.product_id;

      const monthlyPriceResponse = await base44.functions.invoke('createStripePrice', {
        product_id: productId,
        amount: formData.monthly_price_amount,
        currency: formData.currency,
        interval: 'month'
      });

      if (!monthlyPriceResponse.data.success) {
        throw new Error(monthlyPriceResponse.data.error);
      }

      const annualPriceResponse = await base44.functions.invoke('createStripePrice', {
        product_id: productId,
        amount: formData.annual_price_amount,
        currency: formData.currency,
        interval: 'year'
      });

      if (!annualPriceResponse.data.success) {
        throw new Error(annualPriceResponse.data.error);
      }

      setFormData({
        ...formData,
        stripe_product_id: productId,
        stripe_price_id_monthly: monthlyPriceResponse.data.price_id,
        stripe_price_id_annual: annualPriceResponse.data.price_id
      });

      toast({
        title: "Stripe product aangemaakt",
        description: "Product en prijzen zijn succesvol aangemaakt in Stripe",
      });

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Fout bij Stripe",
        description: error.message,
      });
    }
    setIsCreatingProduct(false);
  };

  const handleSubmit = () => {
    if (editingPlan) {
      updatePlanMutation.mutate({ id: editingPlan.id, data: formData });
    } else {
      createPlanMutation.mutate(formData);
    }
  };

  const handleEdit = (plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description || "",
      group_id: plan.group_id || "",
      stripe_product_id: plan.stripe_product_id,
      stripe_price_id_monthly: plan.stripe_price_id_monthly,
      stripe_price_id_annual: plan.stripe_price_id_annual,
      monthly_price_amount: plan.monthly_price_amount,
      annual_price_amount: plan.annual_price_amount,
      currency: plan.currency,
      features: plan.features || {
        plugins: { enabled: false, limit: 0 },
        themes: { enabled: false, limit: 0 },
        sites: { enabled: false, limit: 0 },
        projects: { enabled: false, limit: 0 },
        teams: { enabled: false, limit: 0 }
      },
      vat_rate_percentage: plan.vat_rate_percentage || 21,
      trial_days: plan.trial_days || 0,
      is_active: plan.is_active,
      is_highlighted: plan.is_highlighted || false,
      highlight_label: plan.highlight_label || "",
      annual_discount_percentage: plan.annual_discount_percentage || 0,
      sort_order: plan.sort_order || 0
    });
    setShowDialog(true);
  };

  const resetForm = () => {
    setEditingPlan(null);
    setFormData({
      name: "",
      description: "",
      group_id: "",
      stripe_product_id: "",
      stripe_price_id_monthly: "",
      stripe_price_id_annual: "",
      monthly_price_amount: 0,
      annual_price_amount: 0,
      currency: "EUR",
      features: {
        plugins: { enabled: false, limit: 0 },
        themes: { enabled: false, limit: 0 },
        sites: { enabled: false, limit: 0 },
        projects: { enabled: false, limit: 0 },
        teams: { enabled: false, limit: 0 }
      },
      vat_rate_percentage: 21,
      trial_days: 14,
      is_active: true,
      is_highlighted: false,
      highlight_label: "",
      annual_discount_percentage: 0,
      sort_order: 0
    });
  };

  const updateFeature = (featureKey, field, value) => {
    setFormData(prev => ({
      ...prev,
      features: {
        ...prev.features,
        [featureKey]: {
          ...prev.features[featureKey],
          [field]: value
        }
      }
    }));
  };

  const formatPrice = (amountInCents, currency) => {
    const amount = amountInCents / 100;
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const getFeatureIcon = (featureKey) => {
    const icons = {
      plugins: Package,
      themes: Palette,
      sites: Globe,
      projects: Briefcase,
      teams: Users
    };
    return icons[featureKey] || Package;
  };

  const getFeatureLabel = (featureKey) => {
    const labels = {
      plugins: 'Plugins',
      themes: 'Themes',
      sites: 'Sites',
      projects: 'Projecten',
      teams: 'Teams'
    };
    return labels[featureKey] || featureKey;
  };

  const plansGrouped = plans.reduce((acc, plan) => {
    const groupId = plan.group_id || 'ungrouped';
    if (!acc[groupId]) acc[groupId] = [];
    acc[groupId].push(plan);
    return acc;
  }, {});

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Abonnementsplannen</h1>
            <p className="text-gray-600">Beheer je subscription plannen en Stripe integratie</p>
          </div>
          <Button
            onClick={() => {
              resetForm();
              setShowDialog(true);
            }}
            className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nieuw Plan
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : plans.length === 0 ? (
          <Card className="border-none shadow-lg">
            <CardContent className="p-12 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Package className="w-10 h-10 text-indigo-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Nog geen plannen</h3>
              <p className="text-gray-600 mb-6">Maak je eerste abonnementsplan aan</p>
              <Button
                onClick={() => {
                  resetForm();
                  setShowDialog(true);
                }}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nieuw Plan
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {planGroups.map((group) => {
              const groupPlans = plansGrouped[group.id] || [];
              if (groupPlans.length === 0) return null;

              return (
                <div key={group.id}>
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${group.color}20` }}
                    >
                      <Layers className="w-5 h-5" style={{ color: group.color }} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{group.name}</h2>
                      <p className="text-sm text-gray-600">{group.description}</p>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {groupPlans.map((plan) => (
                      <Card key={plan.id} className={`border-2 shadow-lg hover:shadow-xl transition-all ${
                        plan.is_highlighted ? 'border-indigo-500' : 'border-gray-200'
                      }`}>
                        <CardHeader className="border-b border-gray-100 pb-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <CardTitle className="text-lg">{plan.name}</CardTitle>
                                {plan.is_highlighted && (
                                  <Badge className="bg-indigo-100 text-indigo-700">
                                    <Star className="w-3 h-3 mr-1" />
                                    {plan.highlight_label || "Featured"}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 line-clamp-2">{plan.description}</p>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold text-gray-900">
                              {formatPrice(plan.monthly_price_amount, plan.currency)}
                            </span>
                            <span className="text-gray-500">/maand</span>
                          </div>

                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-gray-700 uppercase">Inbegrepen Features:</p>
                            {Object.entries(plan.features || {}).map(([key, feature]) => {
                              const FeatureIcon = getFeatureIcon(key);
                              return feature.enabled ? (
                                <div key={key} className="flex items-center gap-2 text-sm">
                                  <FeatureIcon className="w-4 h-4 text-indigo-600" />
                                  <span className="font-medium">
                                    {feature.limit === -1 ? 'Onbeperkt' : feature.limit} {getFeatureLabel(key)}
                                  </span>
                                </div>
                              ) : null;
                            })}
                          </div>

                          <div className="space-y-2 text-sm pt-2 border-t">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Status:</span>
                              <Badge className={plan.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
                                {plan.is_active ? "Actief" : "Inactief"}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Trial:</span>
                              <span className="font-semibold">{plan.trial_days} dagen</span>
                            </div>
                          </div>

                          <div className="pt-4 border-t border-gray-100 flex gap-2">
                            <Button
                              onClick={() => handleEdit(plan)}
                              variant="outline"
                              size="sm"
                              className="flex-1"
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Bewerken
                            </Button>
                            <Button
                              onClick={() => copyPlanMutation.mutate(plan)}
                              variant="outline"
                              size="sm"
                              className="text-indigo-600 hover:text-indigo-700"
                              title="Plan kopiëren"
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button
                              onClick={() => {
                                if (confirm(`Weet je zeker dat je "${plan.name}" wilt verwijderen?`)) {
                                  deletePlanMutation.mutate(plan.id);
                                }
                              }}
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}

            {plansGrouped['ungrouped'] && plansGrouped['ungrouped'].length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-100">
                    <Package className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Zonder Groep</h2>
                    <p className="text-sm text-gray-600">Plannen die nog niet aan een groep zijn toegewezen</p>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {plansGrouped['ungrouped'].map((plan) => (
                    <Card key={plan.id} className="border-2 border-amber-200 shadow-lg hover:shadow-xl transition-all">
                      <CardHeader className="border-b border-gray-100 pb-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <CardTitle className="text-lg">{plan.name}</CardTitle>
                              <Badge className="bg-amber-100 text-amber-700">
                                Geen groep
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 line-clamp-2">{plan.description}</p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-6 space-y-4">
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold text-gray-900">
                            {formatPrice(plan.monthly_price_amount, plan.currency)}
                          </span>
                          <span className="text-gray-500">/maand</span>
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-gray-700 uppercase">Inbegrepen Features:</p>
                          {Object.entries(plan.features || {}).map(([key, feature]) => {
                            const FeatureIcon = getFeatureIcon(key);
                            return feature.enabled ? (
                              <div key={key} className="flex items-center gap-2 text-sm">
                                <FeatureIcon className="w-4 h-4 text-indigo-600" />
                                <span className="font-medium">
                                  {feature.limit === -1 ? 'Onbeperkt' : feature.limit} {getFeatureLabel(key)}
                                </span>
                              </div>
                            ) : null;
                          })}
                        </div>

                        <div className="space-y-2 text-sm pt-2 border-t">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Status:</span>
                            <Badge className={plan.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
                              {plan.is_active ? "Actief" : "Inactief"}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Trial:</span>
                            <span className="font-semibold">{plan.trial_days} dagen</span>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-gray-100 flex gap-2">
                          <Button
                            onClick={() => handleEdit(plan)}
                            variant="outline"
                            size="sm"
                            className="flex-1"
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Bewerken
                          </Button>
                          <Button
                            onClick={() => copyPlanMutation.mutate(plan)}
                            variant="outline"
                            size="sm"
                            className="text-indigo-600 hover:text-indigo-700"
                            title="Plan kopiëren"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => {
                              if (confirm(`Weet je zeker dat je "${plan.name}" wilt verwijderen?`)) {
                                deletePlanMutation.mutate(plan.id);
                              }
                            }}
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <Dialog open={showDialog} onOpenChange={(open) => {
          if (!open) resetForm();
          setShowDialog(open);
        }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPlan ? "Plan Bewerken" : "Nieuw Plan Aanmaken"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 mt-4">
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Basis Informatie</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Plan Naam *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="Bijv: Professional"
                    />
                  </div>
                  <div>
                    <Label htmlFor="group_id">Plan Groep</Label>
                    <Select
                      value={formData.group_id || ''}
                      onValueChange={(value) => setFormData({...formData, group_id: value === '' ? null : value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecteer een groep" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>Geen groep</SelectItem>
                        {planGroups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="sort_order">Sorteervolgorde (binnen groep)</Label>
                  <Input
                    id="sort_order"
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({...formData, sort_order: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div>
                  <Label htmlFor="description">Beschrijving</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Korte beschrijving van het plan"
                    rows={3}
                  />
                </div>
              </div>

              {/* Stripe Integration */}
              {!editingPlan && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Stripe Integratie</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="monthly_price">Maandelijkse Prijs (in centen) *</Label>
                      <Input
                        id="monthly_price"
                        type="number"
                        value={formData.monthly_price_amount}
                        onChange={(e) => setFormData({...formData, monthly_price_amount: parseInt(e.target.value) || 0})}
                        placeholder="2900"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Bijv: 2900 = €29.00
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="annual_price">Jaarlijkse Prijs (in centen) *</Label>
                      <Input
                        id="annual_price"
                        type="number"
                        value={formData.annual_price_amount}
                        onChange={(e) => setFormData({...formData, annual_price_amount: parseInt(e.target.value) || 0})}
                        placeholder="29900"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Bijv: 29900 = €299.00
                      </p>
                    </div>
                  </div>
                  {!formData.stripe_product_id && (
                    <Button
                      onClick={handleCreateStripeProduct}
                      disabled={isCreatingProduct || !formData.name || !formData.monthly_price_amount || !formData.annual_price_amount}
                      className="w-full"
                    >
                      {isCreatingProduct ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Stripe Product Aanmaken...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Stripe Product & Prijzen Aanmaken
                        </>
                      )}
                    </Button>
                  )}
                  {formData.stripe_product_id && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2 text-green-700 mb-2">
                        <CheckCircle className="w-5 h-5" />
                        <span className="font-semibold">Stripe Product Aangemaakt</span>
                      </div>
                      <p className="text-sm text-green-600">Product ID: {formData.stripe_product_id}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Features Configuration */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Features & Limieten</h3>
                <p className="text-sm text-gray-600">
                  Stel per feature in of deze beschikbaar is in dit plan en wat de limieten zijn.
                  Gebruik -1 voor onbeperkt.
                </p>
                
                <div className="space-y-4">
                  {Object.entries(formData.features).map(([featureKey, feature]) => {
                    const FeatureIcon = getFeatureIcon(featureKey);
                    const featureLabel = getFeatureLabel(featureKey);
                    
                    return (
                      <div key={featureKey} className="p-4 border-2 rounded-lg transition-all" style={{
                        borderColor: feature.enabled ? '#6366f1' : '#e5e7eb',
                        backgroundColor: feature.enabled ? '#eef2ff' : '#ffffff'
                      }}>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              feature.enabled ? 'bg-indigo-500' : 'bg-gray-300'
                            }`}>
                              <FeatureIcon className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{featureLabel}</p>
                              <p className="text-xs text-gray-600">
                                {feature.enabled ? 'Ingeschakeld' : 'Uitgeschakeld'}
                              </p>
                            </div>
                          </div>
                          <Switch
                            checked={feature.enabled}
                            onCheckedChange={(checked) => updateFeature(featureKey, 'enabled', checked)}
                          />
                        </div>
                        
                        {feature.enabled && (
                          <div className="mt-3 pt-3 border-t">
                            <Label htmlFor={`${featureKey}-limit`} className="text-sm">
                              Limiet (gebruik -1 voor onbeperkt)
                            </Label>
                            <div className="flex items-center gap-2 mt-2">
                              <Input
                                id={`${featureKey}-limit`}
                                type="number"
                                value={feature.limit}
                                onChange={(e) => updateFeature(featureKey, 'limit', parseInt(e.target.value) || 0)}
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => updateFeature(featureKey, 'limit', -1)}
                                className="flex-shrink-0"
                              >
                                <Infinity className="w-4 h-4 mr-1" />
                                Onbeperkt
                              </Button>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              Huidige instelling: {feature.limit === -1 ? 'Onbeperkt' : `${feature.limit} ${featureLabel.toLowerCase()}`}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Settings */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Instellingen</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Trial Periode (dagen)</Label>
                    <Input
                      type="number"
                      value={formData.trial_days}
                      onChange={(e) => setFormData({...formData, trial_days: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <Label>BTW Percentage</Label>
                    <Input
                      type="number"
                      value={formData.vat_rate_percentage}
                      onChange={(e) => setFormData({...formData, vat_rate_percentage: parseInt(e.target.value) || 0})}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <Label className="text-base">Plan Actief</Label>
                    <p className="text-sm text-gray-600">Maak dit plan beschikbaar voor nieuwe subscriptions</p>
                  </div>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
                  <div>
                    <Label className="text-base flex items-center gap-2">
                      <Crown className="w-4 h-4 text-indigo-600" />
                      Plan Uitlichten
                    </Label>
                    <p className="text-sm text-gray-600">Toon dit plan als aanbevolen</p>
                  </div>
                  <Switch
                    checked={formData.is_highlighted}
                    onCheckedChange={(checked) => setFormData({...formData, is_highlighted: checked})}
                  />
                </div>

                {formData.is_highlighted && (
                  <div>
                    <Label>Highlight Label</Label>
                    <Input
                      value={formData.highlight_label}
                      onChange={(e) => setFormData({...formData, highlight_label: e.target.value})}
                      placeholder="Bijv: Meest Populair"
                    />
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="flex gap-2 pt-4 border-t sm:justify-end">
              <Button
                onClick={handleSubmit}
                disabled={
                  createPlanMutation.isPending ||
                  updatePlanMutation.isPending ||
                  !formData.name ||
                  (!editingPlan && !formData.stripe_product_id)
                }
                className="flex-1 sm:flex-none bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
              >
                {createPlanMutation.isPending || updatePlanMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Opslaan...
                  </>
                ) : (
                  editingPlan ? "Plan Bijwerken" : "Plan Aanmaken"
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDialog(false);
                  resetForm();
                }}
                className="sm:flex-none"
              >
                Annuleren
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}