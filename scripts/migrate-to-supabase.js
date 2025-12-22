import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

// Base44 configuratie
const base44AppId = process.env.VITE_BASE44_APP_ID;
const base44ApiKey = process.env.BASE44_API_KEY || '90b9134429824eaa84994aaf30ad9895';

if (!base44AppId) {
  console.error('❌ VITE_BASE44_APP_ID moet worden ingesteld in .env');
  process.exit(1);
}

// Helper functie om Base44 entities op te halen via REST API
async function fetchBase44Entity(entityName) {
  const url = `https://app.base44.com/api/apps/${base44AppId}/entities/${entityName}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'api_key': base44ApiKey,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Fout bij ophalen van ${entityName}:`, error.message);
    return [];
  }
}

// Supabase configuratie
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY moeten worden ingesteld in .env');
  process.exit(1);
}

const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

// Alle entities die gemigreerd moeten worden
const ENTITIES = [
  'User',
  'Site',
  'Plugin',
  'Theme',
  'Team',
  'TeamRole',
  'TeamMember',
  'Project',
  'ProjectTemplate',
  'Message',
  'Notification',
  'ActivityLog',
  'SupportTicket',
  'SubscriptionPlan',
  'UserSubscription',
  'Invoice',
  'SiteSettings',
  'Connector',
  'PluginInstallation',
];

// Entity mapping - Base44 naar Supabase table namen
const TABLE_MAPPING = {
  'User': 'users',
  'Site': 'sites',
  'Plugin': 'plugins',
  'Theme': 'themes',
  'Team': 'teams',
  'TeamRole': 'team_roles',
  'TeamMember': 'team_members',
  'Project': 'projects',
  'ProjectTemplate': 'project_templates',
  'Message': 'messages',
  'Notification': 'notifications',
  'ActivityLog': 'activity_logs',
  'SupportTicket': 'support_tickets',
  'SubscriptionPlan': 'subscription_plans',
  'UserSubscription': 'user_subscriptions',
  'Invoice': 'invoices',
  'SiteSettings': 'site_settings',
  'Connector': 'connectors',
  'PluginInstallation': 'plugin_installations',
};

// Statistieken bijhouden
const stats = {
  total: 0,
  success: 0,
  errors: 0,
  skipped: 0,
};

// Helper functie om data te transformeren en mappen naar Supabase schema
function transformData(entityName, data) {
  const transformed = {
    base44_id: data.id,
    created_at: data.created_date ? new Date(data.created_date).toISOString() : new Date().toISOString(),
    updated_at: data.updated_date ? new Date(data.updated_date).toISOString() : new Date().toISOString(),
  };
  
  // Entity-specifieke mapping
  switch (entityName) {
    case 'User':
      Object.assign(transformed, {
        email: data.email,
        full_name: data.full_name,
        avatar_url: data.avatar_url,
        company: data.company,
        phone: data.phone,
        role: data.role || data._app_role || 'user',
        status: data.status || 'active',
        email_notifications: true,
        two_factor_enabled: data.two_fa_enabled || false,
        two_factor_secret: data.two_fa_code,
        stripe_customer_id: data.stripe_customer_id,
      });
      break;
      
    case 'Site':
      Object.assign(transformed, {
        name: data.name,
        url: data.url,
        api_key: data.api_key,
        owner_type: data.owner_type,
        owner_id: data.owner_id,
        shared_with_teams: data.shared_with_teams || [],
        connection_status: data.connection_status || 'unknown',
        connection_checked_at: data.connection_checked_at,
        wp_version: data.wp_version,
        transfer_request: data.transfer_request,
        health_check: data.health_check,
        health_alerts_enabled: data.health_alerts_enabled !== false,
        created_by: data.created_by,
        created_by_id: data.created_by_id,
        is_sample: data.is_sample || false,
      });
      break;
      
    case 'Plugin':
      Object.assign(transformed, {
        name: data.name,
        slug: data.slug,
        description: data.description,
        author: data.author,
        author_url: data.author_url,
        icon_url: data.icon_url,
        owner_type: data.owner_type,
        owner_id: data.owner_id,
        source: data.source || 'upload',
        versions: data.versions || [],
        latest_version: data.latest_version,
        installed_on: data.installed_on || [],
        shared_with_teams: data.shared_with_teams || [],
        is_disabled: data.is_disabled || false,
        disabled_reason: data.disabled_reason,
        created_by: data.created_by,
        created_by_id: data.created_by_id,
        is_sample: data.is_sample || false,
      });
      break;
      
    case 'Theme':
      Object.assign(transformed, {
        name: data.name,
        slug: data.slug,
        description: data.description,
        author: data.author,
        author_url: data.author_url,
        screenshot_url: data.screenshot_url,
        owner_type: data.owner_type,
        owner_id: data.owner_id,
        source: data.source || 'upload',
        versions: data.versions || [],
        latest_version: data.latest_version,
        installed_on: data.installed_on || [],
        shared_with_teams: data.shared_with_teams || [],
        is_disabled: data.is_disabled || false,
        disabled_reason: data.disabled_reason,
        created_by: data.created_by,
        created_by_id: data.created_by_id,
        is_sample: data.is_sample || false,
      });
      break;
      
    case 'Team':
      Object.assign(transformed, {
        name: data.name,
        description: data.description,
        owner_id: data.owner_id,
        avatar_url: data.avatar_url,
        members: data.members || [],
        settings: data.settings || {},
        inbox_id: data.inbox_id,
        is_blocked: data.is_blocked || false,
        created_by: data.created_by,
        created_by_id: data.created_by_id,
        is_sample: data.is_sample || false,
      });
      break;
      
    case 'TeamRole':
      Object.assign(transformed, {
        team_id: data.team_id,
        name: data.name,
        description: data.description,
        type: data.type,
        permissions: data.permissions || {},
        is_active: data.is_active !== false,
        assigned_count: data.assigned_count || 0,
        created_by: data.created_by,
        created_by_id: data.created_by_id,
        is_sample: data.is_sample || false,
      });
      break;
      
    case 'Project':
      Object.assign(transformed, {
        title: data.title,
        description: data.description,
        team_id: data.team_id,
        site_id: data.site_id,
        inbox_id: data.inbox_id,
        status: data.status || 'planning',
        start_date: data.start_date,
        end_date: data.end_date,
        priority: data.priority || 'medium',
        assigned_members: data.assigned_members || [],
        notes: data.notes,
        attachments: data.attachments || [],
        timeline_events: data.timeline_events || [],
        template_id: data.template_id,
        plugins: data.plugins || [],
        created_by: data.created_by,
        created_by_id: data.created_by_id,
        is_sample: data.is_sample || false,
      });
      break;
      
    case 'ProjectTemplate':
      Object.assign(transformed, {
        name: data.name,
        description: data.description,
        team_id: data.team_id,
        plugins: data.plugins || [],
        icon: data.icon,
        color: data.color,
        is_public: data.is_public || false,
        created_by: data.created_by,
        created_by_id: data.created_by_id,
        is_sample: data.is_sample || false,
      });
      break;
      
    case 'Message':
      Object.assign(transformed, {
        subject: data.subject,
        message: data.message,
        sender_id: data.sender_id,
        sender_email: data.sender_email,
        sender_name: data.sender_name,
        to_mailbox_id: data.to_mailbox_id,
        from_mailbox_id: data.from_mailbox_id,
        from_admin_outbox: data.from_admin_outbox || false,
        thread_id: data.thread_id,
        reply_to_message_id: data.reply_to_message_id,
        original_message_quote: data.original_message_quote,
        recipient_type: data.recipient_type,
        recipient_id: data.recipient_id,
        recipient_ids: data.recipient_ids || [],
        recipient_email: data.recipient_email,
        team_id: data.team_id,
        context: data.context,
        category: data.category,
        priority: data.priority,
        status: data.status || 'sent',
        is_read: data.is_read || false,
        is_archived: data.is_archived || false,
        attachments: data.attachments || [],
        replies: data.replies || [],
        created_by: data.created_by,
        created_by_id: data.created_by_id,
        is_sample: data.is_sample || false,
      });
      break;
      
    case 'Notification':
      Object.assign(transformed, {
        title: data.title,
        message: data.message,
        type: data.type || 'info',
        recipient_id: data.recipient_id,
        recipient_ids: data.recipient_ids || [],
        recipient_email: data.recipient_email,
        recipient_type: data.recipient_type || 'user',
        team_id: data.team_id,
        team_ids: data.team_ids || [],
        team_invite_id: data.team_invite_id,
        sender_id: data.sender_id,
        sender_name: data.sender_name,
        context: data.context,
        is_read: data.is_read || false,
        replies: data.replies || [],
        reply_to_notification_id: data.reply_to_notification_id,
        created_by: data.created_by,
        created_by_id: data.created_by_id,
        is_sample: data.is_sample || false,
      });
      break;
      
    case 'ActivityLog':
      Object.assign(transformed, {
        user_email: data.user_email,
        action: data.action,
        entity_type: data.entity_type,
        entity_id: data.entity_id,
        details: data.details,
        created_by: data.created_by,
        created_by_id: data.created_by_id,
        is_sample: data.is_sample || false,
      });
      break;
      
    case 'SupportTicket':
      Object.assign(transformed, {
        ticket_number: data.ticket_number,
        subject: data.subject,
        description: data.description,
        category: data.category,
        priority: data.priority || 'medium',
        status: data.status || 'open',
        submitter_id: data.submitter_id,
        submitter_email: data.submitter_email,
        submitter_name: data.submitter_name,
        assigned_to: data.assigned_to,
        responses: data.responses || [],
        attachments: data.attachments || [],
        last_updated: data.last_updated,
        resolved_at: data.resolved_at,
        created_by: data.created_by,
        created_by_id: data.created_by_id,
        is_sample: data.is_sample || false,
      });
      break;
      
    case 'SubscriptionPlan':
      Object.assign(transformed, {
        name: data.name,
        description: data.description,
        group_id: data.group_id,
        stripe_product_id: data.stripe_product_id,
        stripe_price_id_monthly: data.stripe_price_id_monthly,
        stripe_price_id_annual: data.stripe_price_id_annual,
        features: data.features || {},
        monthly_price_amount: data.monthly_price_amount,
        annual_price_amount: data.annual_price_amount,
        currency: data.currency || 'EUR',
        vat_rate_percentage: data.vat_rate_percentage || 21,
        is_active: data.is_active !== false,
        sort_order: data.sort_order || 0,
        trial_days: data.trial_days || 0,
        is_highlighted: data.is_highlighted || false,
        highlight_label: data.highlight_label,
        annual_discount_percentage: data.annual_discount_percentage,
        created_by: data.created_by,
        created_by_id: data.created_by_id,
        is_sample: data.is_sample || false,
      });
      break;
      
    case 'UserSubscription':
      Object.assign(transformed, {
        user_id: data.user_id,
        plan_id: data.plan_id,
        is_manual: data.is_manual || false,
        assigned_by: data.assigned_by,
        manual_end_date: data.manual_end_date,
        stripe_customer_id: data.stripe_customer_id,
        stripe_subscription_id: data.stripe_subscription_id,
        status: data.status || 'active',
        current_period_start: data.current_period_start,
        current_period_end: data.current_period_end,
        trial_start: data.trial_start,
        trial_end: data.trial_end,
        cancel_at_period_end: data.cancel_at_period_end || false,
        canceled_at: data.canceled_at,
        interval: data.interval,
        amount: data.amount,
        currency: data.currency || 'EUR',
        vat_percentage: data.vat_percentage || 21,
        discount_code_used: data.discount_code_used,
        usage_tracking: data.usage_tracking || {},
        created_by: data.created_by,
        created_by_id: data.created_by_id,
        is_sample: data.is_sample || false,
      });
      break;
      
    case 'Invoice':
      Object.assign(transformed, {
        invoice_number: data.invoice_number,
        user_id: data.user_id,
        user_email: data.user_email,
        user_name: data.user_name,
        subscription_id: data.subscription_id,
        stripe_invoice_id: data.stripe_invoice_id,
        stripe_payment_intent_id: data.stripe_payment_intent_id,
        amount: data.amount,
        subtotal: data.subtotal,
        vat_amount: data.vat_amount,
        vat_percentage: data.vat_percentage || 21,
        currency: data.currency || 'EUR',
        plan_name: data.plan_name,
        billing_period: data.billing_period,
        period_start: data.period_start,
        period_end: data.period_end,
        status: data.status || 'pending',
        paid_at: data.paid_at,
        due_date: data.due_date,
        description: data.description,
        billing_address: data.billing_address,
        created_by: data.created_by,
        created_by_id: data.created_by_id,
        is_sample: data.is_sample || false,
      });
      break;
      
    case 'SiteSettings':
      Object.assign(transformed, {
        setting_key: data.setting_key,
        setting_value: data.setting_value,
        description: data.description,
        created_by: data.created_by,
        created_by_id: data.created_by_id,
        is_sample: data.is_sample || false,
      });
      break;
      
    case 'Connector':
      Object.assign(transformed, {
        version: data.version,
        file_url: data.file_url,
        file_uri: data.file_uri,
        plugin_code: data.plugin_code,
        description: data.description,
        created_by: data.created_by,
        created_by_id: data.created_by_id,
        is_sample: data.is_sample || false,
      });
      break;
  }
  
  return transformed;
}

// Migreer een enkele entity
async function migrateEntity(entityName) {
  console.log(`\n📦 Migreren van ${entityName}...`);
  
  try {
    const tableName = TABLE_MAPPING[entityName];
    if (!tableName) {
      console.warn(`⚠️  Geen table mapping gevonden voor ${entityName}`);
      stats.skipped++;
      return;
    }

    // Haal alle data op van Base44 via REST API
    let allData = [];
    try {
      allData = await fetchBase44Entity(entityName);
      
      if (!Array.isArray(allData)) {
        console.warn(`⚠️  Onverwacht data formaat voor ${entityName}`);
        stats.skipped++;
        return;
      }
    } catch (error) {
      console.error(`❌ Fout bij ophalen van ${entityName}:`, error.message);
      stats.errors++;
      return;
    }

    console.log(`   Gevonden: ${allData.length} records`);
    
    if (allData.length === 0) {
      console.log(`   ⏭️  Geen data om te migreren`);
      return;
    }

    // Transformeer en insert data in batches
    const BATCH_SIZE = 100;
    let inserted = 0;
    let failed = 0;

    for (let i = 0; i < allData.length; i += BATCH_SIZE) {
      const batch = allData.slice(i, i + BATCH_SIZE);
      const transformedBatch = batch.map(item => transformData(entityName, item));

      try {
        const { data, error } = await supabase
          .from(tableName)
          .upsert(transformedBatch, { onConflict: 'base44_id' });

        if (error) {
          console.error(`   ❌ Batch fout (${i}-${i + batch.length}):`, error.message);
          failed += batch.length;
          stats.errors += batch.length;
        } else {
          inserted += batch.length;
          stats.success += batch.length;
          console.log(`   ✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} records`);
        }
      } catch (error) {
        console.error(`   ❌ Onverwachte fout in batch:`, error.message);
        failed += batch.length;
        stats.errors += batch.length;
      }
    }

    stats.total += allData.length;
    console.log(`   ✨ Klaar: ${inserted} succesvol, ${failed} gefaald`);

  } catch (error) {
    console.error(`❌ Fout bij migreren van ${entityName}:`, error.message);
    stats.errors++;
  }
}

// Main migratie functie
async function migrate() {
  console.log('🚀 Start Base44 naar Supabase migratie\n');
  console.log('=' .repeat(50));
  
  const startTime = Date.now();

  // Test connecties
  console.log('🔌 Test connecties...');
  
  try {
    // Test Supabase
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error && error.code !== 'PGRST116') { // PGRST116 = table niet gevonden is OK
      console.error('❌ Supabase connectie mislukt:', error.message);
      process.exit(1);
    }
    console.log('✅ Supabase verbonden');
  } catch (error) {
    console.error('❌ Supabase connectie mislukt:', error.message);
    process.exit(1);
  }

  try {
    // Test Base44 - probeer Site entity op te halen
    const testData = await fetchBase44Entity('Site');
    console.log(`✅ Base44 verbonden (${Array.isArray(testData) ? testData.length : 0} sites gevonden)`);
  } catch (error) {
    console.warn('⚠️  Base44 connectie probleem:', error.message);
    console.log('   Doorgaan met migratie...');
  }

  console.log('=' .repeat(50));

  // Migreer elke entity
  for (const entityName of ENTITIES) {
    await migrateEntity(entityName);
  }

  // Toon statistieken
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  console.log('\n' + '=' .repeat(50));
  console.log('📊 Migratie Statistieken');
  console.log('=' .repeat(50));
  console.log(`⏱️  Duur: ${duration}s`);
  console.log(`📦 Totaal records: ${stats.total}`);
  console.log(`✅ Succesvol: ${stats.success}`);
  console.log(`❌ Fouten: ${stats.errors}`);
  console.log(`⏭️  Overgeslagen: ${stats.skipped}`);
  console.log('=' .repeat(50));

  if (stats.errors > 0) {
    console.log('\n⚠️  Migratie voltooid met fouten');
    process.exit(1);
  } else {
    console.log('\n✨ Migratie succesvol voltooid!');
    process.exit(0);
  }
}

// Voer migratie uit
migrate().catch(error => {
  console.error('\n💥 Fatale fout:', error);
  process.exit(1);
});
