import React, { createContext, useState, useContext, useEffect } from 'react';
import { getSupabase } from '@/api/getSupabase';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings] = useState(false); // Keep for backward compatibility
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings] = useState(null); // Keep for backward compatibility

  useEffect(() => {
    let authListener;
    (async () => {
      const { supabase } = await getSupabase();
      await checkAuth(supabase);

      // Subscribe to auth changes
      authListener = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          loadUserData(session.user);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setIsAuthenticated(false);
        }
      });
    })();

    return () => {
      try { authListener?.subscription?.unsubscribe(); } catch {}
    };
  }, []);

  const checkAuth = async (supabaseParam) => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);
      const supabase = supabaseParam || (await getSupabase()).supabase;
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) throw error;
      
      if (session?.user) {
        await loadUserData(session.user);
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setAuthError({
        type: 'auth_error',
        message: error.message || 'Authentication check failed'
      });
      setIsAuthenticated(false);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const loadUserData = async (authUser) => {
    try {
      // Get user data from public.users table
      const { supabase } = await getSupabase();
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error) {
        // User might not exist in public.users yet (new OAuth user)
        console.warn('User not found in public.users, using auth data only');
        setUser({
          id: authUser.id,
          email: authUser.email,
          full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0],
          avatar_url: authUser.user_metadata?.avatar_url,
        });
      } else {
        setUser(userData);
        
        // Create Stripe customer if user doesn't have one
        if (!userData.stripe_customer_id) {
          console.log('User has no stripe_customer_id, creating Stripe customer...');
          try {
            const { data: session } = await supabase.auth.getSession();
            const { data: customerData, error: customerError } = await supabase.functions.invoke(
              'create-stripe-customer',
              {
                headers: {
                  Authorization: `Bearer ${session.session.access_token}`
                }
              }
            );
            
            if (customerError) {
              console.error('Failed to create Stripe customer:', customerError);
            } else {
              console.log('Stripe customer created:', customerData);
              // Refresh user data to get updated stripe_customer_id
              const { data: updatedUser } = await supabase
                .from('users')
                .select('*')
                .eq('id', authUser.id)
                .single();
              if (updatedUser) {
                setUser(updatedUser);
              }
            }
          } catch (err) {
            console.error('Error creating Stripe customer:', err);
          }
        }
      }
      
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Failed to load user data:', error);
      // Still set authenticated with minimal data
      setUser({
        id: authUser.id,
        email: authUser.email,
      });
      setIsAuthenticated(true);
    }
  };

  const logout = async (shouldRedirect = true) => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setIsAuthenticated(false);
      
      if (shouldRedirect) {
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      checkAppState: checkAuth // Alias for backward compatibility
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
