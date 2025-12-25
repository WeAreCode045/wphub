// Base44 naar Supabase adapter
// Behoudt de Base44 API interface maar gebruikt Supabase onder de motorkap

async function getClients() {
  const mod = await import('./supabaseClient.js');
  return {
    supabase: mod.supabase,
    supabaseAdmin: mod.supabase, // Use regular client for frontend operations
    supabaseQueries: mod.supabaseQueries,
  };
}

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
    const { supabase } = await getClients();
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order(orderBy.replace('-', ''), { ascending: !orderBy.startsWith('-') })
      .range(skip, skip + limit - 1);
    
    if (error) throw error;
    return data || [];
  },

  async get(id) {
    const { supabase } = await getClients();
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  async filter(filters, orderBy = '-created_at', limit = 1000) {
    const { supabase } = await getClients();
    let query = supabase.from(tableName).select('*');
    
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
    const { supabase } = await getClients();
    const { data: result, error } = await supabase
      .from(tableName)
      .insert(data)
      .select()
      .single();
    
    if (error) throw error;
    return result;
  },

  async update(id, data) {
    const { supabase } = await getClients();
    const { data: result, error } = await supabase
      .from(tableName)
      .update(data)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return result;
  },

  async delete(id) {
    const { supabase } = await getClients();
    const { error } = await supabase
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
    const { supabaseAdmin: db } = await getClients();
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
  const baseAdapter = createEntityAdapter('users');
  
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
  Site: createEntityAdapter('sites'),
  Plugin: createEntityAdapter('plugins'),
  Theme: createEntityAdapter('themes'),
  Team: createEntityAdapter('teams'),
  TeamRole: createEntityAdapter('team_roles'),
  TeamMember: createEntityAdapter('team_members'),
  Project: createEntityAdapter('projects'),
  ProjectTemplate: createEntityAdapter('project_templates'),
  Message: createEntityAdapter('messages'),
  Notification: createEntityAdapter('notifications'),
  ActivityLog: createEntityAdapter('activity_logs'),
  SupportTicket: createEntityAdapter('support_tickets'),
  SubscriptionPlan: createEntityAdapter('subscription_plans'),
  UserSubscription: createEntityAdapter('user_subscriptions'),
  Invoice: createEntityAdapter('invoices'),
  SiteSettings: createEntityAdapter('site_settings'),
  Connector: createEntityAdapter('connectors'),
};

// Query helper (Base44 compatible)
export const Query = {
  from: (tableName) => ({
    select: (fields = '*') => ({
      eq: async (field, value) => {
        const { supabaseQueries, supabase } = await getClients();
        if (supabaseQueries && supabaseQueries[tableName]) return supabaseQueries[tableName].filter({ [field]: value });
        const { data } = await supabase.from(tableName).select(fields).eq(field, value);
        return data;
      },
      filter: async (filters) => {
        const { supabaseQueries, supabase } = await getClients();
        if (supabaseQueries && supabaseQueries[tableName]) return supabaseQueries[tableName].filter(filters);
        const { data } = await supabase.from(tableName).select(fields);
        return data;
      },
    }),
  }),
};

// Auth adapter (voor Base44 auth.me())
export const auth = {
  async me() {
    const { supabase } = await getClients();
    const { data: { user } = {}, error } = await supabase.auth.getUser();

    if (error) throw error;

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
    const { supabase } = await getClients();
    const { data: { user } = {}, error: authError } = await supabase.auth.getUser();

    if (authError) throw authError;

    if (user) {
      const { data: updatedUser, error: updateError } = await supabase
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
    const { supabase } = await getClients();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
};

// Integrations adapter (voor Base44 integrations zoals UploadFile)
export const integrations = {
  Core: {
    async UploadFile({ file, bucket = null }) {
      // Upload file naar Supabase Storage
      // Kies bucket gebaseerd op bestandstype of expliciete parameter
      let targetBucket = bucket;
      
      if (!targetBucket) {
        // Auto-detect bucket based on file type
        if (file.name && file.name.endsWith('.zip')) {
          // Voorlopig alle .zip bestanden naar Plugins bucket
          // Later kunnen we dit verfijnen met context
          targetBucket = 'Plugins';
        } else {
          targetBucket = 'uploads';
        }
      }
      
      const fileName = `${Date.now()}-${file.name}`;
      const { supabase } = await getClients();
      const { data, error } = await supabase.storage
        .from(targetBucket)
        .upload(fileName, file);

      if (error) throw error;

      const { data: pu } = await supabase.storage
        .from(targetBucket)
        .getPublicUrl(fileName);

      const publicUrl = pu?.publicUrl || null;

      return {
        file_url: publicUrl,
        path: data?.path,
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
    const { supabase } = await getClients();
    const { data: { session } = {} } = await supabase.auth.getSession();
    const token = session?.access_token || null;

    const url = `/functions/${name}`;

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

// Export alles in Base44-compatible formaat
export const supabaseAdapter = {
  entities,
  auth,
  Query,
  integrations,
  functions,
};
