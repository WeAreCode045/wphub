import { useState, useEffect } from "react";
import { entities } from "@/api/entities";
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
  X
} from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

export default function ProductManagement() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm({
    defaultValues: {
      name: '',
      description: '',
      stripe_product_id: '',
      stripe_price_monthly_id: '',
      stripe_price_yearly_id: '',
      position: 0,
      is_public: true,
      is_subscription: true,
      trial_days: 14
    }
  });

  // Get all subscription plans
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: () => entities.SubscriptionPlan.list(),
  });

  // Create plan mutation
  const createPlanMutation = useMutation({
    mutationFn: (data) => entities.SubscriptionPlan.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
      setShowCreateDialog(false);
      reset();
      toast.success("Abonnementsplan succesvol aangemaakt");
    },
    onError: (error) => {
      toast.error("Fout bij aanmaken abonnement: " + error.message);
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
    setValue('stripe_product_id', plan.stripe_product_id);
    setValue('stripe_price_monthly_id', plan.stripe_price_monthly_id || '');
    setValue('stripe_price_yearly_id', plan.stripe_price_yearly_id || '');
    setValue('position', plan.position);
    setValue('is_public', plan.is_public);
    setValue('is_subscription', plan.is_subscription);
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
                <h3 className="text-lg font-medium">Stripe Koppeling</h3>

                <div className="space-y-2">
                  <Label htmlFor="stripe_product_id">Stripe Product ID *</Label>
                  <Input
                    id="stripe_product_id"
                    {...register('stripe_product_id', { required: 'Stripe Product ID is verplicht' })}
                    placeholder="prod_..."
                  />
                  {errors.stripe_product_id && <p className="text-sm text-red-600">{errors.stripe_product_id.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="stripe_price_monthly_id">Maandelijkse Price ID</Label>
                    <Input
                      id="stripe_price_monthly_id"
                      {...register('stripe_price_monthly_id')}
                      placeholder="price_..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="stripe_price_yearly_id">Jaarlijkse Price ID</Label>
                    <Input
                      id="stripe_price_yearly_id"
                      {...register('stripe_price_yearly_id')}
                      placeholder="price_..."
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="trial_days">Proefperiode (dagen)</Label>
                  <Input
                    id="trial_days"
                    type="number"
                    {...register('trial_days', { valueAsNumber: true })}
                    placeholder="14"
                  />
                </div>

                <div className="flex items-center space-x-2 pt-8">
                  <Switch
                    id="is_public"
                    {...register('is_public')}
                    defaultChecked={watch('is_public')}
                  />
                  <Label htmlFor="is_public">Openbaar zichtbaar</Label>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_subscription"
                  {...register('is_subscription')}
                  defaultChecked={watch('is_subscription')}
                />
                <Label htmlFor="is_subscription">Is abonnement (niet eenmalig)</Label>
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
                  <span className="text-gray-600">Product ID:</span>
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                    {plan.stripe_product_id.slice(-8)}
                  </code>
                </div>

                {plan.stripe_price_monthly_id && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Maandelijks:</span>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {plan.stripe_price_monthly_id.slice(-8)}
                    </code>
                  </div>
                )}

                {plan.stripe_price_yearly_id && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Jaarlijks:</span>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {plan.stripe_price_yearly_id.slice(-8)}
                    </code>
                  </div>
                )}

                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Proefperiode:</span>
                  <span>{plan.trial_days || 0} dagen</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Positie:</span>
                  <span>{plan.position}</span>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(plan)}
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
  );
}