import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const AppContext = createContext();

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [userTeams, setUserTeams] = useState([]);
  const [userTeamIds, setUserTeamIds] = useState([]);
  const [platformSettings, setPlatformSettings] = useState({
    name: "WP Cloud Hub",
    subtitle: "Plugin Management",
    icon: null
  });
  const [isLoading, setIsLoading] = useState(true);

  // Load all global data once on mount
  useEffect(() => {
    loadGlobalData();
  }, []);

  const loadGlobalData = async () => {
    try {
      setIsLoading(true);
      
      // Load user
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Load user subscription
      if (currentUser?.id) {
        const subscriptions = await base44.entities.UserSubscription.filter({
          user_id: currentUser.id,
          status: ['active', 'trialing']
        });
        setSubscription(subscriptions.length > 0 ? subscriptions[0] : null);
      }

      // Load user teams (once)
      if (currentUser?.id) {
        const allTeams = await base44.entities.Team.list();
        const teams = allTeams.filter(t =>
          t.owner_id === currentUser.id ||
          t.members?.some(m => m.user_id === currentUser.id && m.status === "active")
        );
        setUserTeams(teams);
        setUserTeamIds(teams.map(t => t.id));
      }

      // Load platform settings (once)
      const settings = await base44.entities.SiteSettings.list();
      const name = settings.find(s => s.setting_key === 'platform_name')?.setting_value;
      const subtitle = settings.find(s => s.setting_key === 'platform_subtitle')?.setting_value;
      const icon = settings.find(s => s.setting_key === 'platform_icon')?.setting_value;

      setPlatformSettings({
        name: name || "WP Cloud Hub",
        subtitle: subtitle || "Plugin Management",
        icon: icon || null
      });

    } catch (error) {
      console.error('Error loading global data:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh only user data (for profile updates, etc.)
  const refreshUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      return currentUser;
    } catch (error) {
      console.error('Error refreshing user:', error);
      return null;
    }
  };

  // Refresh only subscription data
  const refreshSubscription = async () => {
    if (!user?.id) return null;
    
    try {
      const subscriptions = await base44.entities.UserSubscription.filter({
        user_id: user.id,
        status: ['active', 'trialing']
      });
      const sub = subscriptions.length > 0 ? subscriptions[0] : null;
      setSubscription(sub);
      return sub;
    } catch (error) {
      console.error('Error refreshing subscription:', error);
      return null;
    }
  };

  // Refresh only teams data
  const refreshTeams = async () => {
    if (!user?.id) return;
    
    try {
      const allTeams = await base44.entities.Team.list();
      const teams = allTeams.filter(t =>
        t.owner_id === user.id ||
        t.members?.some(m => m.user_id === user.id && m.status === "active")
      );
      setUserTeams(teams);
      setUserTeamIds(teams.map(t => t.id));
    } catch (error) {
      console.error('Error refreshing teams:', error);
    }
  };

  const value = {
    // State
    user,
    subscription,
    userTeams,
    userTeamIds,
    platformSettings,
    isLoading,
    
    // Methods
    refreshUser,
    refreshSubscription,
    refreshTeams,
    loadGlobalData,
    
    // Setters (for manual updates when needed)
    setUser,
    setSubscription,
    setUserTeams
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};