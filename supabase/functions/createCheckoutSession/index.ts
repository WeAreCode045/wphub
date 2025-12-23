import { createClientFromRequest } from '../base44Shim.js';
import Stripe from 'npm:stripe@14.11.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'), {
  apiVersion: '2023-10-16',
});

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { plan_id, billing_cycle, discount_code, success_url, cancel_url } = await req.json();

    if (!plan_id || !billing_cycle) {
      return Response.json({
        error: 'plan_id and billing_cycle are required'
      }, { status: 400 });
    }

    // Get the subscription plan
    const plan = await base44.asServiceRole.entities.SubscriptionPlan.get(plan_id);
    
    if (!plan) {
      return Response.json({ error: 'Plan not found' }, { status: 404 });
    }

    if (!plan.is_active) {
      return Response.json({ error: 'This plan is not available' }, { status: 400 });
    }

    // Select the right price based on billing cycle
    const priceId = billing_cycle === 'annual' 
      ? plan.stripe_price_id_annual 
      : plan.stripe_price_id_monthly;

    // Get or create Stripe customer
    let customerId;
    const existingUser = await base44.asServiceRole.entities.User.get(user.id);
    
    if (existingUser.stripe_customer_id) {
      customerId = existingUser.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.full_name,
        metadata: {
          user_id: user.id,
          platform: 'wp-cloud-hub'
        }
      });
      customerId = customer.id;
      
      // Save customer ID to user
      await base44.asServiceRole.auth.updateUser(user.id, {
        stripe_customer_id: customerId
      });
    }

    // Prepare session parameters
    const sessionParams = {
      customer: customerId,
      mode: 'subscription',
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      success_url: success_url || `${Deno.env.get('YOUR_PLATFORM_URL')}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || `${Deno.env.get('YOUR_PLATFORM_URL')}/pricing`,
      metadata: {
        user_id: user.id,
        plan_id: plan_id,
        billing_cycle: billing_cycle
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan_id: plan_id,
          billing_cycle: billing_cycle
        }
      },
      automatic_tax: {
        enabled: true
      }
    };

    // Add trial if configured
    if (plan.trial_days > 0) {
      sessionParams.subscription_data.trial_period_days = plan.trial_days;
    }

    // Add discount code if provided
    if (discount_code) {
      const discounts = await base44.asServiceRole.entities.DiscountCode.filter({
        code: discount_code,
        is_active: true
      });

      if (discounts.length > 0) {
        const discount = discounts[0];
        
        // Check if code is expired
        if (discount.expires_at && new Date(discount.expires_at) < new Date()) {
          return Response.json({
            error: 'Discount code has expired'
          }, { status: 400 });
        }

        // Check max redemptions
        if (discount.max_redemptions && discount.times_redeemed >= discount.max_redemptions) {
          return Response.json({
            error: 'Discount code has reached maximum redemptions'
          }, { status: 400 });
        }

        // Check if applies to this plan
        if (discount.applies_to_plans.length > 0 && !discount.applies_to_plans.includes(plan_id)) {
          return Response.json({
            error: 'Discount code not valid for this plan'
          }, { status: 400 });
        }

        if (discount.stripe_coupon_id) {
          sessionParams.discounts = [{
            coupon: discount.stripe_coupon_id
          }];
        }
      }
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create(sessionParams);

    await base44.asServiceRole.entities.ActivityLog.create({
      user_email: user.email,
      action: `Checkout session aangemaakt voor plan: ${plan.name}`,
      entity_type: 'subscription',
      details: `Session ID: ${session.id}, Billing: ${billing_cycle}`
    });

    return Response.json({
      success: true,
      session_id: session.id,
      url: session.url
    });

  } catch (error) {
    console.error('Error creating checkout session:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});