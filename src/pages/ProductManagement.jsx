import { useState, useEffect } from "react";
import { entities, functions } from "@/api/entities";
import { getSupabase } from "@/api/getSupabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Edit,
  Trash2,
  Package,
  DollarSign,
  Eye,
  EyeOff,
  Save,
  X,
  Zap
} from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";

export default function ProductManagement() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Check admin status
  useEffect(() => {
    if (user && !user.role) {
      toast.error('Your role has not been set. Contact an administrator.');
    } else if (user && user.role !== 'admin') {
      toast.error(`You do not have permission to access this page. Your role: ${user.role}`);
    }
  }, [user]);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm({
    defaultValues: {
      name: '',
      description: '',
      monthly_price_cents: 0,
      yearly_price_cents: 0,
      trial_days: 14,
      position: 0,
      is_public: true,
      limits_sites: 5,
      feature_projects: false,
      feature_local_plugins: false,
      feature_local_themes: false,
      feature_team_invites: false,
    }
  });

  // Get all subscription plans
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: () => entities.SubscriptionPlan.list(),
  });

  // Create plan mutation - calls edge function to create in Stripe
  const createPlanMutation = useMutation({
    mutationFn: async (data) => {
      // Get Supabase client and session
      const supabaseClient = await getSupabase();
      const { data: { session }, error: sessionError } = await supabaseClient.supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error('Authentication failed. Please log in again.');
      }

      const token = session.access_token;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/admin-create-plan`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: data.name,
            description: data.description,
            monthly_price_cents: Math.round(data.monthly_price_cents * 100),
            yearly_price_cents: Math.round(data.yearly_price_cents * 100),
            trial_days: data.trial_days,
            position: data.position,
            is_public: data.is_public,
            features: {
              limits_sites: data.limits_sites,
              feature_projects: data.feature_projects,
              feature_local_plugins: data.feature_local_plugins,
              feature_local_themes: data.feature_local_themes,
              feature_team_invites: data.feature_team_invites,
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}: Failed to create plan`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
      setShowCreateDialog(false);
      reset();
      toast.success("Abonnementsplan en Stripe product succesvol aangemaakt");
    },
    onError: (error) => {
      toast.error("Fout bij aanmaken: " + error.message);
    }
  });

  // Update plan mutation
  const updatePlanMutation = useMutation({
    mutationFn: ({ id, data }) => entities.SubscriptionPlan.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
      setEditingPlan(null);
      reset();
      toast.success("Abonnementsplan succesvol bijgewerkt");
    },
    onError: (error) => {
      toast.error("Fout bij bijwerken abonnement: " + error.message);
    }
  });

  // Delete plan mutation
  const deletePlanMutation = useMutation({
    mutationFn: (id) => entities.SubscriptionPlan.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
      toast.success("Abonnementsplan succesvol verwijderd");
    },
    onError: (error) => {
      toast.error("Fout bij verwijderen abonnement: " + error.message);
    }
  });

  const onSubmit = (data) => {
    if (editingPlan) {
      updatePlanMutation.mutate({ id: editingPlan.id, data });
    } else {
      createPlanMutation.mutate(data);
    }
  };

  const handleEdit = (plan) => {
    setEditingPlan(plan);
    setValue('name', plan.name);
    setValue('description', plan.description || '');
    setValue('monthly_price_cents', plan.monthly_price_cents ? plan.monthly_price_cents / 100 : 0);
    setValue('yearly_price_cents', plan.yearly_price_cents ? plan.yearly_price_cents / 100 : 0);
    setValue('position', plan.position);
    setValue('is_public', plan.is_public);
    setValue('trial_days', plan.trial_days || 14);
    setShowCreateDialog(true);
  };

  const handleDelete = (planId) => {
    if (confirm('Weet je zeker dat je dit abonnement wilt verwijderen?')) {
      deletePlanMutation.mutate(planId);
    }
  };

  const handleCancel = () => {
    setShowCreateDialog(false);
    setEditingPlan(null);
    reset();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Beheer</h1>
          <p className="text-sm text-gray-600">Beheer abonnementen en Stripe product koppelingen</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingPlan(null); reset(); }}>
              <Plus className="w-4 h-4 mr-2" />
              Nieuw Abonnement
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPlan ? 'Abonnement Bewerken' : 'Nieuw Abonnement Aanmaken'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Naam *</Label>
                  <Input
                    id="name"
                    {...register('name', { required: 'Naam is verplicht' })}
                    placeholder="Bijv. Pro Plan"
                  />
                  {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="position">Positie</Label>
                  <Input
                    id="position"
                    type="number"
                    {...register('position', { valueAsNumber: true })}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Beschrijving</Label>
                <Textarea
                  id="description"
                  {...register('description')}
                  placeholder="Beschrijving van het abonnement..."
                  rows={3}
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium flex items-center">
                  <DollarSign className="w-5 h-5 mr-2" />
                  Prijzen
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="monthly_price_cents">Maandelijkse prijs ($) *</Label>
                    <Input
                      id="monthly_price_cents"
                      type="number"
                      step="0.01"
                      {...register('monthly_price_cents', {
                        required: 'Maandelijkse prijs is verplicht',
                        valueAsNumber: true,
                        min: { value: 0, message: 'Prijs moet groter zijn dan 0' }
                      })}
                      placeholder="29.99"
                    />
                    {errors.monthly_price_cents && <p className="text-sm text-red-600">{errors.monthly_price_cents.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="yearly_price_cents">Jaarlijkse prijs ($) *</Label>
                    <Input
                      id="yearly_price_cents"
                      type="number"
                      step="0.01"
                      {...register('yearly_price_cents', {
                        required: 'Jaarlijkse prijs is verplicht',
                        valueAsNumber: true,
                        min: { value: 0, message: 'Prijs moet groter zijn dan 0' }
                      })}
                      placeholder="299.99"
                    />
                    {errors.yearly_price_cents && <p className="text-sm text-red-600">{errors.yearly_price_cents.message}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trial_days">Proefperiode (dagen)</Label>
                  <Input
                    id="trial_days"
                    type="number"
                    {...register('trial_days', { valueAsNumber: true })}
                    placeholder="14"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium flex items-center">
                  <Zap className="w-5 h-5 mr-2" />
                  Functies & Limieten
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="limits_sites">Max. aantal websites</Label>
                    <Input
                      id="limits_sites"
                      type="number"
                      {...register('limits_sites', { valueAsNumber: true })}
                      placeholder="5"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="trial_days_alt">Proefperiode</Label>
                    <Input
                      disabled
                      value={`${watch('trial_days')} dagen`}
                      className="bg-gray-50"
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="feature_projects"
                      {...register('feature_projects')}
                      checked={watch('feature_projects')}
                    />
                    <Label htmlFor="feature_projects" className="mb-0">Projecten feature</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="feature_local_plugins"
                      {...register('feature_local_plugins')}
                      checked={watch('feature_local_plugins')}
                    />
                    <Label htmlFor="feature_local_plugins" className="mb-0">Lokale plugins uploaden</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="feature_local_themes"
                      {...register('feature_local_themes')}
                      checked={watch('feature_local_themes')}
                    />
                    <Label htmlFor="feature_local_themes" className="mb-0">Lokale thema's uploaden</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="feature_team_invites"
                      {...register('feature_team_invites')}
                      checked={watch('feature_team_invites')}
                    />
                    <Label htmlFor="feature_team_invites" className="mb-0">Team leden uitnodigen</Label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="position">Volgorde (voor weergave)</Label>
                  <Input
                    id="position"
                    type="number"
                    {...register('position', { valueAsNumber: true })}
                    placeholder="0"
                  />
                </div>

                <div className="flex items-center space-x-2 pt-8">
                  <Switch
                    id="is_public"
                    {...register('is_public')}
                    checked={watch('is_public')}
                  />
                  <Label htmlFor="is_public">Openbaar zichtbaar</Label>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCancel}>
                  <X className="w-4 h-4 mr-2" />
                  Annuleren
                </Button>
                <Button type="submit" disabled={createPlanMutation.isPending || updatePlanMutation.isPending}>
                  <Save className="w-4 h-4 mr-2" />
                  {editingPlan ? 'Bijwerken' : 'Aanmaken'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Plans Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <Card key={plan.id} className="border-none shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <div className="flex items-center space-x-2">
                  {plan.is_public ? (
                    <Eye className="w-4 h-4 text-green-600" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-gray-400" />
                  )}
                  <Badge variant={plan.is_subscription ? "default" : "secondary"}>
                    {plan.is_subscription ? 'Abonnement' : 'Eenmalig'}
                  </Badge>
                </div>
              </div>
              {plan.description && (
                <p className="text-sm text-gray-600">{plan.description}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Maandelijkse prijs:</span>
                  <span className="font-semibold">${(plan.monthly_price_cents / 100).toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Jaarlijkse prijs:</span>
                  <span className="font-semibold">${(plan.yearly_price_cents / 100).toFixed(2)}</span>
                </div>

                <div className="border-t my-2 pt-2">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Proefperiode:</span>
                    <span>{plan.trial_days || 0} dagen</span>
                  </div>

                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Websites:</span>
                    <span>{plan.monthly_price_cents ? 'Onbeperkt' : 'Limiet'}</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Positie:</span>
                    <span>{plan.position}</span>
                  </div>
                </div>

                <div className="text-xs text-gray-500 mt-2 p-2 bg-gray-50 rounded">
                  <div>Product ID: {plan.stripe_product_id.slice(-8)}</div>
                  {plan.stripe_price_monthly_id && (
                    <div>Monthly: {plan.stripe_price_monthly_id.slice(-8)}</div>
                  )}
                  {plan.stripe_price_yearly_id && (
                    <div>Yearly: {plan.stripe_price_yearly_id.slice(-8)}</div>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(plan)}
                  disabled
                  title="Bewerken is niet beschikbaar via Stripe"
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(plan.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {plans.length === 0 && (
        <Card className="border-none shadow-md">
          <CardContent className="text-center py-12">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Geen abonnementen gevonden</h3>
            <p className="text-gray-600 mb-4">Maak je eerste abonnement aan om te beginnen.</p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Eerste Abonnement Aanmaken
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
    </div>
    </div>
  );
}