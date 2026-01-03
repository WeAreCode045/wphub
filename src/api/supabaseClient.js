import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

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

// NOTE: admin/service-role client must not be created in the frontend bundle.
// Server-side/admin tasks should run as Supabase Edge Functions (see supabase/functions/) with runtime secrets.

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

// --- Begin direct client API (merged from supabaseClientDirect) ---

// Entity operations
const entities = {
  User: {
    async list() {
      const { data, error } = await supabase.from('users').select('*');
      if (error) throw error;
      return data || [];
    },

    async get(id) {
      const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },

    async filter(filters) {
      let query = supabase.from('users').select('*');
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async create(data) {
      const { data: result, error } = await supabase.from('users').insert(data).select().single();
      if (error) throw error;
      return result;
    },

    async update(id, data) {
      const { data: result, error } = await supabase.from('users').update(data).eq('id', id).select().single();
      if (error) throw error;
      return result;
    },

    async delete(id) {
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) throw error;
    }
  },

  Site: {
    async list(orderBy = '-created_at', limit = 1000) {
      const { data, error } = await supabase
        .from('sites')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },

    async get(id) {
      const { data, error } = await supabase.from('sites').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },

    async filter(filters, orderBy = '-created_at', limit = 1000) {
      let query = supabase.from('sites').select('*');
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      query = query.order('created_at', { ascending: false });
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async create(data) {
      const { data: result, error } = await supabase.from('sites').insert(data).select().single();
      if (error) throw error;
      return result;
    },

    async update(id, data) {
      const { data: result, error } = await supabase.from('sites').update(data).eq('id', id).select().single();
      if (error) throw error;
      return result;
    },

    async delete(id) {
      const { error } = await supabase.from('sites').delete().eq('id', id);
      if (error) throw error;
    }
  },

  Plugin: {
    async list(orderBy = '-created_at', limit = 1000) {
      const { data, error } = await supabase
        .from('plugins')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },

    async get(id) {
      const { data, error } = await supabase.from('plugins').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },

    async filter(filters, orderBy = '-created_at', limit = 1000) {
      let query = supabase.from('plugins').select('*');
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      query = query.order('created_at', { ascending: false });
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async create(data) {
      const { data: result, error } = await supabase.from('plugins').insert(data).select().single();
      if (error) throw error;
      return result;
    },

    async update(id, data) {
      const { data: result, error } = await supabase.from('plugins').update(data).eq('id', id).select().single();
      if (error) throw error;
      return result;
    },

    async delete(id) {
      const { error } = await supabase.from('plugins').delete().eq('id', id);
      if (error) throw error;
    }
  },

  Theme: {
    async list(orderBy = '-created_at', limit = 1000) {
      const { data, error } = await supabase
        .from('themes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },

    async get(id) {
      const { data, error } = await supabase.from('themes').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },

    async filter(filters, orderBy = '-created_at', limit = 1000) {
      let query = supabase.from('themes').select('*');
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      query = query.order('created_at', { ascending: false });
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async create(data) {
      const { data: result, error } = await supabase.from('themes').insert(data).select().single();
      if (error) throw error;
      return result;
    },

    async update(id, data) {
      const { data: result, error } = await supabase.from('themes').update(data).eq('id', id).select().single();
      if (error) throw error;
      return result;
    },

    async delete(id) {
      const { error } = await supabase.from('themes').delete().eq('id', id);
      if (error) throw error;
    }
  },

  Team: {
    async list() {
      const { data, error } = await supabase.from('teams').select('*');
      if (error) throw error;
      return data || [];
    },

    async get(id) {
      const { data, error } = await supabase.from('teams').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },

    async filter(filters) {
      let query = supabase.from('teams').select('*');
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async create(data) {
      const { data: result, error } = await supabase.from('teams').insert(data).select().single();
      if (error) throw error;
      return result;
    },

    async update(id, data) {
      const { data: result, error } = await supabase.from('teams').update(data).eq('id', id).select().single();
      if (error) throw error;
      return result;
    },

    async delete(id) {
      const { error } = await supabase.from('teams').delete().eq('id', id);
      if (error) throw error;
    }
  },

  Project: {
    async list() {
      const { data, error } = await supabase.from('projects').select('*');
      if (error) throw error;
      return data || [];
    },

    async get(id) {
      const { data, error } = await supabase.from('projects').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },

    async filter(filters) {
      let query = supabase.from('projects').select('*');
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async create(data) {
      const { data: result, error } = await supabase.from('projects').insert(data).select().single();
      if (error) throw error;
      return result;
    },

    async update(id, data) {
      const { data: result, error } = await supabase.from('projects').update(data).eq('id', id).select().single();
      if (error) throw error;
      return result;
    },

    async delete(id) {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
    }
  },

  Message: {
    async list() {
      const { data, error } = await supabase.from('messages').select('*');
      if (error) throw error;
      return data || [];
    },

    async get(id) {
      const { data, error } = await supabase.from('messages').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },

    async filter(filters) {
      let query = supabase.from('messages').select('*');
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async create(data) {
      const { data: result, error } = await supabase.from('messages').insert(data).select().single();
      if (error) throw error;
      return result;
    },

    async update(id, data) {
      const { data: result, error } = await supabase.from('messages').update(data).eq('id', id).select().single();
      if (error) throw error;
      return result;
    },

    async delete(id) {
      const { error } = await supabase.from('messages').delete().eq('id', id);
      if (error) throw error;
    }
  },

  Notification: {
    async list() {
      const { data, error } = await supabase.from('notifications').select('*');
      if (error) throw error;
      return data || [];
    },

    async get(id) {
      const { data, error } = await supabase.from('notifications').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },

    async filter(filters) {
      let query = supabase.from('notifications').select('*');
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async create(data) {
      const { data: result, error } = await supabase.from('notifications').insert(data).select().single();
      if (error) throw error;
      return result;
    },

    async update(id, data) {
      const { data: result, error } = await supabase.from('notifications').update(data).eq('id', id).select().single();
      if (error) throw error;
      return result;
    },

    async delete(id) {
      const { error } = await supabase.from('notifications').delete().eq('id', id);
      if (error) throw error;
    }
  },

  ActivityLog: {
    async list() {
      const { data, error } = await supabase.from('activity_logs').select('*');
      if (error) throw error;
      return data || [];
    },

    async get(id) {
      const { data, error } = await supabase.from('activity_logs').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },

    async filter(filters) {
      let query = supabase.from('activity_logs').select('*');
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async create(data) {
      const { data: result, error } = await supabase.from('activity_logs').insert(data).select().single();
      if (error) throw error;
      return result;
    },

    async update(id, data) {
      const { data: result, error } = await supabase.from('activity_logs').update(data).eq('id', id).select().single();
      if (error) throw error;
      return result;
    },

    async delete(id) {
      const { error } = await supabase.from('activity_logs').delete().eq('id', id);
      if (error) throw error;
    }
  },

  SiteSettings: {
    async list() {
      const { data, error } = await supabase.from('site_settings').select('*');
      if (error) throw error;
      return data || [];
    },

    async get(id) {
      const { data, error } = await supabase.from('site_settings').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },

    async filter(filters) {
      let query = supabase.from('site_settings').select('*');
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async create(data) {
      const { data: result, error } = await supabase.from('site_settings').insert(data).select().single();
      if (error) throw error;
      return result;
    },

    async update(id, data) {
      const { data: result, error } = await supabase.from('site_settings').update(data).eq('id', id).select().single();
      if (error) throw error;
      return result;
    },

    async delete(id) {
      const { error } = await supabase.from('site_settings').delete().eq('id', id);
      if (error) throw error;
    }
  },

  Connector: {
    async list() {
      const { data, error } = await supabase.from('connectors').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async get(id) {
      const { data, error } = await supabase.from('connectors').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },

    async filter(filters) {
      let query = supabase.from('connectors').select('*');
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async create(data) {
      const { data: result, error } = await supabase.from('connectors').insert(data).select().single();
      if (error) throw error;
      return result;
    },

    async update(id, data) {
      const { data: result, error } = await supabase.from('connectors').update(data).eq('id', id).select().single();
      if (error) throw error;
      return result;
    },

    async delete(id) {
      const { error } = await supabase.from('connectors').delete().eq('id', id);
      if (error) throw error;
    }
  },

  TeamInvite: {
    async list() {
      const { data, error } = await supabase.from('team_invites').select('*');
      if (error) throw error;
      return data || [];
    },

    async get(id) {
      const { data, error } = await supabase.from('team_invites').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },

    async filter(filters) {
      let query = supabase.from('team_invites').select('*');
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async create(data) {
      const { data: result, error } = await supabase.from('team_invites').insert(data).select().single();
      if (error) throw error;
      return result;
    },

    async update(id, data) {
      const { data: result, error } = await supabase.from('team_invites').update(data).eq('id', id).select().single();
      if (error) throw error;
      return result;
    },

    async delete(id) {
      const { error } = await supabase.from('team_invites').delete().eq('id', id);
      if (error) throw error;
    }
  },

  TeamRole: {
    async list() {
      const { data, error } = await supabase.from('team_roles').select('*');
      if (error) throw error;
      return data || [];
    },

    async get(id) {
      const { data, error } = await supabase.from('team_roles').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },

    async filter(filters) {
      let query = supabase.from('team_roles').select('*');
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async create(data) {
      const { data: result, error } = await supabase.from('team_roles').insert(data).select().single();
      if (error) throw error;
      return result;
    },

    async update(id, data) {
      const { data: result, error } = await supabase.from('team_roles').update(data).eq('id', id).select().single();
      if (error) throw error;
      return result;
    },

    async delete(id) {
      const { error } = await supabase.from('team_roles').delete().eq('id', id);
      if (error) throw error;
    }
  },

  Role: {
    async list(orderBy = '-created_date') {
      const { data, error } = await supabase.from('roles').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async get(id) {
      const { data, error } = await supabase.from('roles').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },

    async filter(filters) {
      let query = supabase.from('roles').select('*');
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async create(data) {
      const { data: result, error } = await supabase.from('roles').insert(data).select().single();
      if (error) throw error;
      return result;
    },

    async update(id, data) {
      const { data: result, error } = await supabase.from('roles').update(data).eq('id', id).select().single();
      if (error) throw error;
      return result;
    },

    async delete(id) {
      const { error } = await supabase.from('roles').delete().eq('id', id);
      if (error) throw error;
    }
  },




  ProjectTemplate: {
    async list(orderBy = '-updated_date') {
      const { data, error } = await supabase.from('project_templates').select('*').order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async get(id) {
      const { data, error } = await supabase.from('project_templates').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },

    async filter(filters, orderBy = '-updated_date') {
      let query = supabase.from('project_templates').select('*');
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      const { data, error } = await query.order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async create(data) {
      const { data: result, error } = await supabase.from('project_templates').insert(data).select().single();
      if (error) throw error;
      return result;
    },

    async update(id, data) {
      const { data: result, error } = await supabase.from('project_templates').update(data).eq('id', id).select().single();
      if (error) throw error;
      return result;
    },

    async delete(id) {
      const { error } = await supabase.from('project_templates').delete().eq('id', id);
      if (error) throw error;
    }
  },

  PlanGroup: {
    async list(orderBy = 'sort_order') {
      const { data, error } = await supabase.from('plan_groups').select('*').order('sort_order', { ascending: true });
      if (error) throw error;
      return data || [];
    },

    async get(id) {
      const { data, error } = await supabase.from('plan_groups').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },

    async filter(filters) {
      let query = supabase.from('plan_groups').select('*');
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async create(data) {
      const { data: result, error } = await supabase.from('plan_groups').insert(data).select().single();
      if (error) throw error;
      return result;
    },

    async update(id, data) {
      const { data: result, error } = await supabase.from('plan_groups').update(data).eq('id', id).select().single();
      if (error) throw error;
      return result;
    },

    async delete(id) {
      const { error } = await supabase.from('plan_groups').delete().eq('id', id);
      if (error) throw error;
    }
  }
};

// Auth operations
const auth = {
  async me() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('email', user.email)
        .single();
      return userData || user;
    }
    return null;
  },

  async updateMe(data) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: updatedUser, error } = await supabase
        .from('users')
        .update(data)
        .eq('email', user.email)
        .select()
        .single();
      if (error) throw error;
      return updatedUser;
    }
    throw new Error('No authenticated user');
  },

  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }
};

// Functions (Supabase Edge Functions)
const functions = {
  async invoke(name, payload = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || null;

    const url = `${supabaseFunctionsUrl.replace(/\/$/, '')}/${name}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload)
    });

    let data;
    try { data = await res.json(); } catch (e) { data = null; }
    if (!res.ok) {
      const e = Object.assign(new Error(`Function ${name} invoke failed: ${res.status}`), { response: data });
      throw e;
    }
    return { data };
  }
};

// Integrations
const integrations = {
  Core: {
    async UploadFile({ file, bucket = 'uploads' }) {
      const fileName = `${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      return { file_url: publicUrl };
    }
  }
};

// Query helper (simplified)
const Query = {
  async run(query, params = {}) {
    // This would need to be implemented based on your specific query needs
    console.warn('Query.run not implemented - use direct Supabase queries');
    return [];
  }
};

// Export the merged direct client API
export const supabaseClientDirect = {
  entities,
  auth,
  functions,
  integrations,
  Query
};

// --- End merged direct client API ---
