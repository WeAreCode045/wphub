import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file.');
}

// Regular client voor normale operaties
export const supabase = createClient(supabaseUrl, supabaseKey);

// Derive functions URL: prefer explicit env var, otherwise convert the standard Supabase URL
export const supabaseFunctionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || (() => {
  try {
    if (supabaseUrl && supabaseUrl.includes('supabase.co')) {
      return supabaseUrl.replace('supabase.co', 'functions.supabase.co');
    }
  } catch (e) { }
  // Fallback to relative /functions (legacy behaviour)
  return '/functions';
})();

// Admin client voor server-side operaties (edge functions)
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
export const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : supabase; // Fallback naar regular client als geen service key

// Helper functions voor data queries
export const supabaseQueries = {
  // Users
  users: {
    list: () => supabase.from('users').select('*').order('created_at', { ascending: false }),
    get: (id) => supabase.from('users').select('*').eq('id', id).single(),
    getByEmail: (email) => supabase.from('users').select('*').eq('email', email).single(),
    update: (id, data) => supabase.from('users').update(data).eq('id', id),
    delete: (id) => supabase.from('users').delete().eq('id', id),
  },

  // Sites
  sites: {
    list: () => supabase.from('sites').select('*').order('created_at', { ascending: false }),
    get: (id) => supabase.from('sites').select('*').eq('id', id).single(),
    filter: (filters) => {
      let query = supabase.from('sites').select('*');
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      return query;
    },
    create: (data) => supabase.from('sites').insert(data).select().single(),
    update: (id, data) => supabase.from('sites').update(data).eq('id', id),
    delete: (id) => supabase.from('sites').delete().eq('id', id),
  },

  // Plugins
  plugins: {
    list: () => supabase.from('plugins').select('*').order('updated_at', { ascending: false }),
    get: (id) => supabase.from('plugins').select('*').eq('id', id).single(),
    filter: (filters) => {
      let query = supabase.from('plugins').select('*');
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      return query;
    },
    create: (data) => supabase.from('plugins').insert(data).select().single(),
    update: (id, data) => supabase.from('plugins').update(data).eq('id', id),
    delete: (id) => supabase.from('plugins').delete().eq('id', id),
  },

  // Themes
  themes: {
    list: () => supabase.from('themes').select('*').order('created_at', { ascending: false }),
    get: (id) => supabase.from('themes').select('*').eq('id', id).single(),
    filter: (filters) => {
      let query = supabase.from('themes').select('*');
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      return query;
    },
    create: (data) => supabase.from('themes').insert(data).select().single(),
    update: (id, data) => supabase.from('themes').update(data).eq('id', id),
    delete: (id) => supabase.from('themes').delete().eq('id', id),
  },

  // Teams
  teams: {
    list: () => supabase.from('teams').select('*').order('created_at', { ascending: false }),
    get: (id) => supabase.from('teams').select('*').eq('id', id).single(),
    filter: (filters) => {
      let query = supabase.from('teams').select('*');
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      return query;
    },
    create: (data) => supabase.from('teams').insert(data).select().single(),
    update: (id, data) => supabase.from('teams').update(data).eq('id', id),
    delete: (id) => supabase.from('teams').delete().eq('id', id),
  },

  // Team Roles
  teamRoles: {
    list: () => supabase.from('team_roles').select('*'),
    filter: (filters) => {
      let query = supabase.from('team_roles').select('*');
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      return query;
    },
    create: (data) => supabase.from('team_roles').insert(data).select().single(),
    update: (id, data) => supabase.from('team_roles').update(data).eq('id', id),
  },

  // Projects
  projects: {
    list: () => supabase.from('projects').select('*').order('created_at', { ascending: false }),
    get: (id) => supabase.from('projects').select('*').eq('id', id).single(),
    filter: (filters) => {
      let query = supabase.from('projects').select('*');
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      return query;
    },
    create: (data) => supabase.from('projects').insert(data).select().single(),
    update: (id, data) => supabase.from('projects').update(data).eq('id', id),
    delete: (id) => supabase.from('projects').delete().eq('id', id),
  },

  // Project Templates
  projectTemplates: {
    list: () => supabase.from('project_templates').select('*').order('updated_at', { ascending: false }),
    filter: (filters) => {
      let query = supabase.from('project_templates').select('*');
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      return query;
    },
    create: (data) => supabase.from('project_templates').insert(data).select().single(),
    update: (id, data) => supabase.from('project_templates').update(data).eq('id', id),
    delete: (id) => supabase.from('project_templates').delete().eq('id', id),
  },

  // Messages
  messages: {
    list: () => supabase.from('messages').select('*').order('created_at', { ascending: false }),
    filter: (filters) => {
      let query = supabase.from('messages').select('*');
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      return query;
    },
    create: (data) => supabase.from('messages').insert(data).select().single(),
    update: (id, data) => supabase.from('messages').update(data).eq('id', id),
    delete: (id) => supabase.from('messages').delete().eq('id', id),
  },

  // Notifications
  notifications: {
    list: () => supabase.from('notifications').select('*').order('created_at', { ascending: false }),
    filter: (filters) => {
      let query = supabase.from('notifications').select('*');
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      return query.order('created_at', { ascending: false });
    },
    create: (data) => supabase.from('notifications').insert(data).select().single(),
    update: (id, data) => supabase.from('notifications').update(data).eq('id', id),
    delete: (id) => supabase.from('notifications').delete().eq('id', id),
  },

  // Activity Logs
  activityLogs: {
    list: () => supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(50),
    filter: (filters) => {
      let query = supabase.from('activity_logs').select('*');
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      return query.order('created_at', { ascending: false });
    },
    create: (data) => supabase.from('activity_logs').insert(data).select().single(),
  },

  // Support Tickets
  supportTickets: {
    list: () => supabase.from('support_tickets').select('*').order('created_at', { ascending: false }),
    filter: (filters) => {
      let query = supabase.from('support_tickets').select('*');
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      return query;
    },
    create: (data) => supabase.from('support_tickets').insert(data).select().single(),
    update: (id, data) => supabase.from('support_tickets').update(data).eq('id', id),
  },

  // Subscription Plans
  subscriptionPlans: {
    list: () => supabase.from('subscription_plans').select('*').order('sort_order', { ascending: true }),
    filter: (filters) => {
      let query = supabase.from('subscription_plans').select('*');
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      return query;
    },
  },

  // User Subscriptions
  userSubscriptions: {
    list: () => supabase.from('user_subscriptions').select('*').order('created_at', { ascending: false }),
    filter: (filters) => {
      let query = supabase.from('user_subscriptions').select('*');
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      return query;
    },
    create: (data) => supabase.from('user_subscriptions').insert(data).select().single(),
    update: (id, data) => supabase.from('user_subscriptions').update(data).eq('id', id),
    delete: (id) => supabase.from('user_subscriptions').delete().eq('id', id),
  },

  // Invoices
  invoices: {
    list: () => supabase.from('invoices').select('*').order('created_at', { ascending: false }),
    filter: (filters) => {
      let query = supabase.from('invoices').select('*');
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      return query;
    },
  },

  // Site Settings
  siteSettings: {
    list: () => supabase.from('site_settings').select('*'),
    get: (key) => supabase.from('site_settings').select('*').eq('setting_key', key).single(),
    update: (key, value) => supabase.from('site_settings').upsert({ 
      setting_key: key, 
      setting_value: value 
    }),
  },

  // Connectors
  connectors: {
    list: () => supabase.from('connectors').select('*').order('created_at', { ascending: false }),
    getLatest: () => supabase.from('connectors').select('*').order('created_at', { ascending: false }).limit(1).single(),
  },
};
