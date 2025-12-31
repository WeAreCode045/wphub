


export function createPageUrl(pageName: string) {
    return '/' + pageName.toLowerCase().replace(/ /g, '-');
}

// Re-export the supabase client for convenience
export { default as supabase } from './supabase';