// Base44 naar Supabase adapter
// Behoudt de Base44 API interface maar gebruikt Supabase onder de motorkap

import { supabase, supabaseAdmin, supabaseQueries } from './supabaseClient';

// Gebruik admin client voor alle operaties (bypass RLS)
const db = supabaseAdmin;

// Helper om Base44 response formaat na te bootsen
const formatResponse = (data) => {
  if (Array.isArray(data)) {
    return data;
  }
  return data ? [data] : [];
};

// Adapter voor elke entity
const createEntityAdapter = (tableName, queryHelper) => ({
  async list(orderBy = '-created_at', limit = 1000, skip = 0) {
    const { data, error } = await db
      .from(tableName)
      .select('*')
      .order(orderBy.replace('-', ''), { ascending: !orderBy.startsWith('-') })
      .range(skip, skip + limit - 1);
    
    if (error) throw error;
    return data || [];
  },

  async get(id) {
    const { data, error } = await db
      .from(tableName)
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  async filter(filters, orderBy = '-created_at', limit = 1000) {
    let query = db.from(tableName).select('*');
    
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
    
    if (orderBy) {
      query = query.order(orderBy.replace('-', ''), { ascending: !orderBy.startsWith('-') });
    }
    
    if (limit) {
      query = query.limit(limit);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  },

  async create(data) {
    const { data: result, error } = await db
      .from(tableName)
      .insert(data)
      .select()
      .single();
    
    if (error) throw error;
    return result;
  },

  async update(id, data) {
    const { data: result, error } = await db
      .from(tableName)
      .update(data)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return result;
  },

  async delete(id) {
    const { error } = await db
      .from(tableName)
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return { success: true };
  },
});

// Helper functie om auth user aan te maken
async function createAuthUserIfNeeded(userData) {
  if (!userData.email) return;
  
  try {
    // Gebruik admin client om auth user aan te maken
    const tempPassword = Math.random().toString(36).slice(-16) + Math.random().toString(36).slice(-16);
    
    const { data: authData, error } = await db.auth.admin.createUser({
      id: userData.id,
      email: userData.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: userData.full_name || userData.email.split('@')[0],
        role: userData.role || 'user',
      }
    });
    
    if (error && !error.message.includes('already registered')) {
      console.error('Error creating auth user:', error);
    } else if (!error) {
      console.log(`✅ Created auth user for ${userData.email}`);
    }
  } catch (error) {
    // Ignore errors - user might already exist
    console.log('Auth user creation skipped:', error.message);
  }
}

// Special adapter voor User entity met auth user synchronisatie
const createUserEntityAdapter = () => {
  const baseAdapter = createEntityAdapter('users', supabaseQueries.users);
  
  return {
    ...baseAdapter,
    async create(data) {
      // Eerst user aanmaken in database
      const result = await baseAdapter.create(data);
      
      // Dan auth user aanmaken
      await createAuthUserIfNeeded(result);
      
      return result;
    },
  };
};

// Export entities met Base44-compatible interface
export const entities = {
  User: createUserEntityAdapter(), // Speciale handler met auth sync
  Site: createEntityAdapter('sites', supabaseQueries.sites),
  Plugin: createEntityAdapter('plugins', supabaseQueries.plugins),
  Theme: createEntityAdapter('themes', supabaseQueries.themes),
  Team: createEntityAdapter('teams', supabaseQueries.teams),
  TeamRole: createEntityAdapter('team_roles', supabaseQueries.teamRoles),
  TeamMember: createEntityAdapter('team_members'),
  Project: createEntityAdapter('projects', supabaseQueries.projects),
  ProjectTemplate: createEntityAdapter('project_templates', supabaseQueries.projectTemplates),
  Message: createEntityAdapter('messages', supabaseQueries.messages),
  Notification: createEntityAdapter('notifications', supabaseQueries.notifications),
  ActivityLog: createEntityAdapter('activity_logs', supabaseQueries.activityLogs),
  SupportTicket: createEntityAdapter('support_tickets', supabaseQueries.supportTickets),
  SubscriptionPlan: createEntityAdapter('subscription_plans', supabaseQueries.subscriptionPlans),
  UserSubscription: createEntityAdapter('user_subscriptions', supabaseQueries.userSubscriptions),
  Invoice: createEntityAdapter('invoices', supabaseQueries.invoices),
  SiteSettings: createEntityAdapter('site_settings', supabaseQueries.siteSettings),
  Connector: createEntityAdapter('connectors', supabaseQueries.connectors),
};

// Query helper (Base44 compatible)
export const Query = {
  from: (tableName) => ({
    select: (fields = '*') => ({
      eq: (field, value) => supabaseQueries[tableName]?.filter({ [field]: value }) || db.from(tableName).select(fields).eq(field, value),
      filter: (filters) => supabaseQueries[tableName]?.filter(filters) || db.from(tableName).select(fields),
    }),
  }),
};

// Auth adapter (voor Base44 auth.me())
export const auth = {
  async me() {
    // In Base44 wordt de user via token opgehaald
    // Voor nu een placeholder - dit moet worden aangepast aan je auth strategie
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) throw error;
    
    if (user) {
      // Haal extra user data op uit de users tabel
      const { data: userData } = await db
        .from('users')
        .select('*')
        .eq('email', user.email)
        .single();
      
      return userData || user;
    }
    
    return null;
  },
  
  async updateMe(data) {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) throw authError;
    
    if (user) {
      // Update user data in users tabel
      const { data: updatedUser, error: updateError } = await db
        .from('users')
        .update(data)
        .eq('email', user.email)
        .select()
        .single();
      
      if (updateError) throw updateError;
      
      return updatedUser;
    }
    
    throw new Error('No authenticated user');
  },
  
  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
};

// Integrations adapter (voor Base44 integrations zoals UploadFile)
export const integrations = {
  Core: {
    async UploadFile({ file }) {
      // Upload file naar Supabase Storage
      const fileName = `${Date.now()}-${file.name}`;
      const { data, error } = await db.storage
        .from('uploads') // Bucket naam - moet gecreëerd worden in Supabase
        .upload(fileName, file);
      
      if (error) throw error;
      
      // Genereer public URL
      const { data: { publicUrl } } = db.storage
        .from('uploads')
        .getPublicUrl(fileName);
      
      return {
        file_url: publicUrl,
        path: data.path,
      };
    },
    
    async InvokeLLM(params) {
      // Placeholder voor LLM calls - kan later geïmplementeerd worden met externe API
      console.warn('InvokeLLM not yet implemented for Supabase');
      throw new Error('InvokeLLM not yet implemented');
    },
    
    async SendEmail(params) {
      // Placeholder voor email - kan later geïmplementeerd worden
      console.warn('SendEmail not yet implemented for Supabase');
      throw new Error('SendEmail not yet implemented');
    },
    
    async SendSMS(params) {
      // Placeholder voor SMS - kan later geïmplementeerd worden
      console.warn('SendSMS not yet implemented for Supabase');
      throw new Error('SendSMS not yet implemented');
    },
    
    async GenerateImage(params) {
      // Placeholder voor image generation - kan later geïmplementeerd worden
      console.warn('GenerateImage not yet implemented for Supabase');
      throw new Error('GenerateImage not yet implemented');
    },
    
    async ExtractDataFromUploadedFile(params) {
      // Placeholder voor data extraction - kan later geïmplementeerd worden
      console.warn('ExtractDataFromUploadedFile not yet implemented for Supabase');
      throw new Error('ExtractDataFromUploadedFile not yet implemented');
    },
  },
};

// Functions adapter - roept serverless functions endpoints aan
export const functions = {
  async invoke(name, payload = {}) {
    const { data: { session } = {} } = await supabase.auth.getSession();
    const token = session?.access_token || null;
    const meta: any = import.meta;
    const urlBase = meta?.env?.VITE_APP_DOMAIN ? String(meta.env.VITE_APP_DOMAIN).replace(/\/$/, '') : '';
    // prefer relative path so dev server proxies work; if VITE_APP_DOMAIN is set, use absolute
    const url = urlBase ? `${urlBase}/functions/${name}` : `/functions/${name}`;

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
      const err: any = new Error(`Function ${name} invoke failed: ${res.status}`);
      err.response = data;
      throw err;
    }
    return data;
  }
};

// Export alles in Base44-compatible formaat
export const supabaseAdapter = {
  entities,
  auth,
  Query,
  integrations,
  functions,
};
