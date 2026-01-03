import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@17.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractBearerFromReq, authMeWithToken, jsonResponse, corsHeaders } from '../_helpers.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);

interface PauseSubscriptionRequest {
  action: 'pause' | 'resume';
  pause_reason?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    // Authenticate user
    const token = extractBearerFromReq(req);
    const caller = await authMeWithToken(token);

    if (!caller) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = (await req.json()) as PauseSubscriptionRequest;
    const { action, pause_reason = null } = body;

    if (!action || !['pause', 'resume'].includes(action)) {
      return jsonResponse({ error: 'action must be "pause" or "resume"' }, 400);
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user's subscription
    const { data: user } = await supabase
      .from('public.users')
      .select('id, stripe_customer_id')
      .eq('id', caller.id)
      .single();

    if (!user?.stripe_customer_id) {
      return jsonResponse(
        { error: 'User does not have a Stripe customer account' },
        400
      );
    }

    // Get user's active subscription from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripe_customer_id,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return jsonResponse({ error: 'No active subscription found' }, 404);
    }

    const subscription = subscriptions.data[0];

    if (action === 'pause') {
      // Pause subscription in Stripe by setting collection_method to send_invoice
      const updatedSub = await stripe.subscriptions.update(subscription.id, {
        pause_collection: {
          behavior: 'mark_uncollectible',
        },
        metadata: {
          ...subscription.metadata,
          paused_at: new Date().toISOString(),
          pause_reason: pause_reason || 'user_requested',
        },
      });

      // Update user's pause status in database
      await supabase
        .from('public.users')
        .update({
          subscription_paused_at: new Date().toISOString(),
          pause_reason: pause_reason || 'user_requested',
        })
        .eq('id', caller.id);

      return jsonResponse({
        success: true,
        action: 'pause',
        subscription_id: updatedSub.id,
        paused_at: updatedSub.metadata?.paused_at,
      });
    } else {
      // Resume subscription
      const updatedSub = await stripe.subscriptions.update(subscription.id, {
        pause_collection: null as any,
        metadata: {
          ...subscription.metadata,
          resumed_at: new Date().toISOString(),
          paused_at: null,
          pause_reason: null,
        },
      });

      // Clear pause status in database
      await supabase
        .from('public.users')
        .update({
          subscription_paused_at: null,
          pause_reason: null,
        })
        .eq('id', caller.id);

      return jsonResponse({
        success: true,
        action: 'resume',
        subscription_id: updatedSub.id,
        resumed_at: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('[PAUSE-SUBSCRIPTION] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return jsonResponse({ error: message }, 500);
  }
});
