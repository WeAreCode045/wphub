import { useState, useEffect } from "react";
import { entities } from "@/api/entities";
import { supabase } from "@/api/supabaseClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Edit,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
  Copy,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useUser } from "../Layout";

export default function SubscriptionPlans() {
  const user = useUser();
  const [showDialog, setShowDialog] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [fetchError, setFetchError] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    active: true,
    default_price: "",
    attrs: {}
  });

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    console.log('SubscriptionPlans: user loaded', user);
    if (user && user.role !== "admin") {
      console.log('SubscriptionPlans: user is not admin, redirecting');
      navigate(createPageUrl("Dashboard"));
    }
  }, [user, navigate]);

  const { data: plans = [], isLoading, error: queryError } = useQuery({
    queryKey: ['admin-subscription-plans'],
    queryFn: async () => {
      if (!user || user.role !== 'admin') {
        console.log('SubscriptionPlans: user not admin or not loaded');
        return [];
      }
      try {
        console.log('SubscriptionPlans: fetching plans');
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        
        if (!token) {
          console.warn('SubscriptionPlans: No auth token available');
          setFetchError('No authentication token available');
          return await entities.SubscriptionPlan.list();
        }
        
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manageSubscriptionPlans`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: 'list' }),
          }
        );
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`SubscriptionPlans edge function error ${response.status}:`, errorText);
          setFetchError(`Failed to fetch plans (${response.status})`);
          throw new Error(`Failed to fetch plans (${response.status})`);
        }
        const data = await response.json();
        console.log('SubscriptionPlans: plans fetched', data);
        setFetchError(null);
        return data;
      } catch (error) {
        console.error('Error fetching plans:', error);
        setFetchError(error.message);
        // Fallback to direct API access
        try {
          return await entities.SubscriptionPlan.list();
        } catch (fallbackError) {
          console.error('Fallback failed:', fallbackError);
          return [];
        }
      }
    },
    enabled: !!user && user.role === "admin",
    staleTime: 5 * 60 * 1000,
    initialData: [],
  });

  const createPlanMutation = useMutation({
    mutationFn: async (planData) => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) throw new Error('Not authenticated');
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manageSubscriptionPlans`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'create', plan: planData }),
        }
      );
      
      if (!response.ok) throw new Error('Failed to create plan');
      return await response.json();
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
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) throw new Error('Not authenticated');
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manageSubscriptionPlans`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'update', plan: { ...data, id } }),
        }
      );
      
      if (!response.ok) throw new Error('Failed to update plan');
      return await response.json();
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
    mutationFn: async (planId) => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) throw new Error('Not authenticated');
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manageSubscriptionPlans`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'delete', plan: { id: planId } }),
        }
      );
      
      if (!response.ok) throw new Error('Failed to delete plan');
      return await response.json();
    },
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
        active: false,
        default_price: plan.default_price,
        attrs: { ...plan.attrs }
      };
      return entities.SubscriptionPlan.create(copiedPlan);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscription-plans'] });
      toast({
        title: "Plan gekopieerd",
        description: "Het plan is succesvol gekopieerd",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Fout bij kopiëren",
        description: error.message,
      });
    }
  });

  const handleSubmit = () => {
    if (!formData.name || !formData.default_price) {
      toast({
        variant: "destructive",
        title: "Validatie fout",
        description: "Plan naam en Stripe prijs ID zijn verplicht",
      });
      return;
    }

    if (editingPlan) {
      updatePlanMutation.mutate({
        id: editingPlan.id,
        data: formData
      });
    } else {
      createPlanMutation.mutate(formData);
    }
  };

  const handleEdit = (plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description || "",
      active: plan.active || true,
      default_price: plan.default_price || "",
      attrs: plan.attrs || {}
    });
    setShowDialog(true);
  };

  const resetForm = () => {
    setEditingPlan(null);
    setFormData({
      name: "",
      description: "",
      active: true,
      default_price: "",
      attrs: {}
    });
  };

  if (!user || user.role !== "admin") {
    return null;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Abonnementsplannen</h1>
          <p className="text-gray-600 mt-1">Beheer de beschikbare Stripe abonnementsplannen</p>
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

      {/* Plans Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : plans.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-600">Geen abonnementsplannen gevonden</p>
            <Button
              onClick={() => {
                resetForm();
                setShowDialog(true);
              }}
              variant="outline"
              className="mt-4"
            >
              <Plus className="w-4 h-4 mr-2" />
              Eerste Plan Aanmaken
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <Card key={plan.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    {plan.description && (
                      <p className="text-sm text-gray-600 mt-1">{plan.description}</p>
                    )}
                  </div>
                  <Badge variant={plan.active ? "default" : "secondary"}>
                    {plan.active ? "Actief" : "Inactief"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-gray-500">Stripe Prijs ID</Label>
                    <p className="text-sm font-mono text-gray-700 break-all">{plan.default_price}</p>
                  </div>
                  
                  <div className="flex gap-2 pt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(plan)}
                      className="flex-1"
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      Bewerken
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyPlanMutation.mutate(plan)}
                      disabled={copyPlanMutation.isPending}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (confirm('Weet je zeker dat je dit plan wilt verwijderen?')) {
                          deletePlanMutation.mutate(plan.id);
                        }
                      }}
                      disabled={deletePlanMutation.isPending}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingPlan ? "Plan Bewerken" : "Nieuw Plan Aanmaken"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
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
              <Label htmlFor="description">Beschrijving</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Korte beschrijving van het plan"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="default_price">Stripe Prijs ID *</Label>
              <Input
                id="default_price"
                value={formData.default_price}
                onChange={(e) => setFormData({...formData, default_price: e.target.value})}
                placeholder="Bijv: price_1A2B3C4D5E"
              />
              <p className="text-xs text-gray-500 mt-1">
                De Stripe prijs ID die aan dit plan is gekoppeld (bijv: price_...)
              </p>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <Label className="text-base">Plan Actief</Label>
                <p className="text-sm text-gray-600">Maak dit plan beschikbaar voor subscriptions</p>
              </div>
              <Switch
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({...formData, active: checked})}
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2 pt-4 border-t sm:justify-end">
            <Button
              onClick={handleSubmit}
              disabled={
                createPlanMutation.isPending ||
                updatePlanMutation.isPending ||
                !formData.name ||
                !formData.default_price
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
  );
}
