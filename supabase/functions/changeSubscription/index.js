import { createClientFromRequest } from '../supabaseClientServer.js';
import Stripe from 'npm:stripe';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await User.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { new_plan_id, action } = await req.json();

    if (!new_plan_id || !action) {
      return Response.json({ 
        error: 'Missing required parameters: new_plan_id and action' 
      }, { status: 400 });
    }

    // Get current active subscription
    const subscriptions = await base44.asServiceRole.entities.UserSubscription.filter({
      user_id: user.id,
      status: ['active', 'trialing']
    });

    if (subscriptions.length === 0) {
      return Response.json({ 
        error: 'No active subscription found' 
      }, { status: 404 });
    }

    const currentSubscription = subscriptions[0];

    // Manual subscriptions cannot be changed via Stripe
    if (currentSubscription.is_manual) {
      return Response.json({ 
        error: 'Manual subscriptions must be changed by an administrator' 
      }, { status: 400 });
    }

    if (!currentSubscription.stripe_subscription_id) {
      return Response.json({ 
        error: 'No Stripe subscription found' 
      }, { status: 404 });
    }

    // Get the new plan details
    const newPlan = await base44.asServiceRole.entities.SubscriptionPlan.get(new_plan_id);
    
    if (!newPlan || !newPlan.is_active) {
      return Response.json({ 
        error: 'Invalid or inactive plan' 
      }, { status: 400 });
    }

    // Get current plan details
    const currentPlan = await base44.asServiceRole.entities.SubscriptionPlan.get(currentSubscription.plan_id);

    // Determine billing interval from current subscription
    const billingInterval = currentSubscription.interval;
    
    // Get the appropriate Stripe price ID based on interval
    const newStripePriceId = billingInterval === 'year' 
      ? newPlan.stripe_price_id_annual 
      : newPlan.stripe_price_id_monthly;

    if (!newStripePriceId) {
      return Response.json({ 
        error: `No ${billingInterval}ly price configured for this plan` 
      }, { status: 400 });
    }

    // Get the Stripe subscription
    const stripeSubscription = await stripe.subscriptions.retrieve(
      currentSubscription.stripe_subscription_id
    );

    if (!stripeSubscription || stripeSubscription.items.data.length === 0) {
      return Response.json({ 
        error: 'Invalid Stripe subscription' 
      }, { status: 404 });
    }

    const subscriptionItemId = stripeSubscription.items.data[0].id;

    // For downgrade, check if usage is within new plan limits
    if (action === 'downgrade') {
      const usageCheck = await checkDowngradeEligibility(base44, user.id, newPlan);
      
      if (!usageCheck.allowed) {
        return Response.json({
          success: false,
          error: 'Downgrade not allowed',
          details: usageCheck.violations
        }, { status: 400 });
      }

      // For downgrade: Schedule change for end of billing period (proration_behavior = none)
      const updatedSubscription = await stripe.subscriptions.update(
        currentSubscription.stripe_subscription_id,
        {
          items: [{
            id: subscriptionItemId,
            price: newStripePriceId,
          }],
          proration_behavior: 'none',
          billing_cycle_anchor: 'unchanged',
        }
      );

      // Update our database - the change will take effect at period end
      await base44.asServiceRole.entities.UserSubscription.update(
        currentSubscription.id,
        {
          // Don't update plan_id yet - it changes at period end
          // Stripe webhook will handle the actual update
          pending_plan_change: new_plan_id
        }
      );

      return Response.json({
        success: true,
        message: 'Downgrade scheduled for end of billing period',
        effective_date: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
        current_plan: currentPlan.name,
        new_plan: newPlan.name
      });

    } else if (action === 'upgrade') {
      // For upgrade: Apply immediately with proration
      const updatedSubscription = await stripe.subscriptions.update(
        currentSubscription.stripe_subscription_id,
        {
          items: [{
            id: subscriptionItemId,
            price: newStripePriceId,
          }],
          proration_behavior: 'create_prorations',
          billing_cycle_anchor: 'unchanged',
        }
      );

      // Calculate new amount based on interval
      const newAmount = billingInterval === 'year' 
        ? newPlan.annual_price_amount 
        : newPlan.monthly_price_amount;

      // Update our database immediately
      await base44.asServiceRole.entities.UserSubscription.update(
        currentSubscription.id,
        {
          plan_id: new_plan_id,
          amount: newAmount,
          currency: newPlan.currency,
          vat_percentage: newPlan.vat_rate_percentage
        }
      );

      // Create activity log
      await base44.asServiceRole.entities.ActivityLog.create({
        user_email: user.email,
        action: `Abonnement geüpgraded van ${currentPlan.name} naar ${newPlan.name}`,
        entity_type: 'user',
        entity_id: user.id
      });

      return Response.json({
        success: true,
        message: 'Upgrade successful',
        prorated_amount: updatedSubscription.latest_invoice?.amount_due || 0,
        current_plan: newPlan.name,
        invoice_url: updatedSubscription.latest_invoice?.hosted_invoice_url
      });

    } else {
      return Response.json({ 
        error: 'Invalid action. Must be "upgrade" or "downgrade"' 
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Change subscription error:', error);
    return Response.json({ 
      error: error.message || 'Failed to change subscription' 
    }, { status: 500 });
  }
});

/**
 * Check if user can downgrade based on current usage
 */
async function checkDowngradeEligibility(base44, userId, newPlan) {
  const violations = [];

  // Check plugins
  if (newPlan.features?.plugins?.enabled) {
    const plugins = await base44.asServiceRole.entities.Plugin.filter({
      owner_type: "user",
      owner_id: userId
    });
    
    const limit = newPlan.features.plugins.limit;
    if (limit !== -1 && plugins.length > limit) {
      violations.push({
        feature: 'plugins',
        current: plugins.length,
        limit: limit,
        message: `Je hebt ${plugins.length} plugins, maar het nieuwe plan staat maximaal ${limit} toe`
      });
    }
  } else if (newPlan.features?.plugins && !newPlan.features.plugins.enabled) {
    const plugins = await base44.asServiceRole.entities.Plugin.filter({
      owner_type: "user",
      owner_id: userId
    });
    if (plugins.length > 0) {
      violations.push({
        feature: 'plugins',
        current: plugins.length,
        limit: 0,
        message: 'Het nieuwe plan ondersteunt geen plugins. Verwijder eerst al je plugins.'
      });
    }
  }

  // Check sites
  if (newPlan.features?.sites?.enabled) {
    const sites = await base44.asServiceRole.entities.Site.filter({
      owner_type: "user",
      owner_id: userId
    });
    
    const limit = newPlan.features.sites.limit;
    if (limit !== -1 && sites.length > limit) {
      violations.push({
        feature: 'sites',
        current: sites.length,
        limit: limit,
        message: `Je hebt ${sites.length} sites, maar het nieuwe plan staat maximaal ${limit} toe`
      });
    }
  } else if (newPlan.features?.sites && !newPlan.features.sites.enabled) {
    const sites = await base44.asServiceRole.entities.Site.filter({
      owner_type: "user",
      owner_id: userId
    });
    if (sites.length > 0) {
      violations.push({
        feature: 'sites',
        current: sites.length,
        limit: 0,
        message: 'Het nieuwe plan ondersteunt geen sites. Verwijder eerst al je sites.'
      });
    }
  }

  // Check teams
  if (newPlan.features?.teams?.enabled) {
    const teams = await base44.asServiceRole.entities.Team.filter({
      owner_id: userId
    });
    
    const limit = newPlan.features.teams.limit;
    if (limit !== -1 && teams.length > limit) {
      violations.push({
        feature: 'teams',
        current: teams.length,
        limit: limit,
        message: `Je hebt ${teams.length} teams, maar het nieuwe plan staat maximaal ${limit} toe`
      });
    }
  } else if (newPlan.features?.teams && !newPlan.features.teams.enabled) {
    const teams = await base44.asServiceRole.entities.Team.filter({
      owner_id: userId
    });
    if (teams.length > 0) {
      violations.push({
        feature: 'teams',
        current: teams.length,
        limit: 0,
        message: 'Het nieuwe plan ondersteunt geen teams. Verwijder eerst al je teams.'
      });
    }
  }

  // Check projects
  if (newPlan.features?.projects?.enabled) {
    const teams = await base44.asServiceRole.entities.Team.filter({
      owner_id: userId
    });
    const teamIds = teams.map(t => t.id);
    const allProjects = await base44.asServiceRole.entities.Project.list();
    const userProjects = allProjects.filter(p => teamIds.includes(p.team_id));
    
    const limit = newPlan.features.projects.limit;
    if (limit !== -1 && userProjects.length > limit) {
      violations.push({
        feature: 'projects',
        current: userProjects.length,
        limit: limit,
        message: `Je hebt ${userProjects.length} projecten, maar het nieuwe plan staat maximaal ${limit} toe`
      });
    }
  } else if (newPlan.features?.projects && !newPlan.features.projects.enabled) {
    const teams = await base44.asServiceRole.entities.Team.filter({
      owner_id: userId
    });
    const teamIds = teams.map(t => t.id);
    const allProjects = await base44.asServiceRole.entities.Project.list();
    const userProjects = allProjects.filter(p => teamIds.includes(p.team_id));
    if (userProjects.length > 0) {
      violations.push({
        feature: 'projects',
        current: userProjects.length,
        limit: 0,
        message: 'Het nieuwe plan ondersteunt geen projecten. Verwijder eerst al je projecten.'
      });
    }
  }

  return {
    allowed: violations.length === 0,
    violations
  };
}



