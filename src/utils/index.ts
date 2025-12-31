


export function createPageUrl(pageName: string) {
    if (!pageName) return '/';
    return pageName.startsWith('/') ? pageName : `/${pageName}`;
}

// Re-export the supabase client for convenience
export { default as supabase } from './supabase';