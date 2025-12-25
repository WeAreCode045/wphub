import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useState, useEffect, createContext, useContext } from "react";
import { base44 } from "@/api/base44Client";
import {
  LayoutDashboard,
  Globe,
  Package,
  Palette,
  Users,
  Settings,
  Bell,
  ChevronDown,
  LogOut,
  Download,
  ShieldCheck,
  Crown,
  Wrench,
  Activity,
  Mail,
  Briefcase,
  Menu,
  X,
  Search,
  Moon,
  Sun,
  CreditCard,
  DollarSign,
  Layers,
  BarChart3,
  Receipt,
  Zap,
  ChevronRight,
  Inbox,
  Send,
  HelpCircle,
  Ticket
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import AIChatAgent from "./components/chat/AIChatAgent";


// Create context for user data
const UserContext = createContext(null);
export const useUser = () => useContext(UserContext);

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [activeConnector, setActiveConnector] = useState(null);
  const [userTeamIds, setUserTeamIds] = useState([]);
  const [userMailboxes, setUserMailboxes] = useState(null);
  const [platformSettings, setPlatformSettings] = useState({
    name: "WP Cloud Hub",
    subtitle: "Plugin Management",
    icon: null
  });
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAdminMenu, setIsAdminMenu] = useState(() => {
    return sessionStorage.getItem('admin_menu_active') === 'true';
  });
  const [businessOpen, setBusinessOpen] = useState(false);
  const [controlRoomOpen, setControlRoomOpen] = useState(false);
  const [manualMenuSwitch, setManualMenuSwitch] = useState(false);
  const queryClient = useQueryClient();

  // Save isAdminMenu state to sessionStorage whenever it changes
  useEffect(() => {
    sessionStorage.setItem('admin_menu_active', isAdminMenu.toString());
  }, [isAdminMenu]);

  // Auto-detect if we're on an admin page and switch menu accordingly
  useEffect(() => {
    if (!user || manualMenuSwitch) return;

    const adminPages = [
      createPageUrl("AdminDashboard"),
      createPageUrl("UserManager"),
      createPageUrl("AdminMessages"),
      createPageUrl("AdminNotifications"),
      createPageUrl("SubscriptionPlans"),
      createPageUrl("PlanGroups"),
      createPageUrl("SubscriptionManager"),
      createPageUrl("FinanceSettings"),
      createPageUrl("SiteSettings"),
      createPageUrl("PlatformActivities"),
      createPageUrl("PlatformTools"),
      createPageUrl("UserDetail"),
      createPageUrl("AdminSupportTickets") // Added for admin menu detection
    ];

    const currentPath = location.pathname;
    const shouldBeAdminMenu = adminPages.some(page => currentPath.startsWith(page));

    if (shouldBeAdminMenu && !isAdminMenu && user.role === 'admin') {
      setIsAdminMenu(true);
    }
  }, [location.pathname, user, isAdminMenu, manualMenuSwitch]);

  // Reset manual switch flag when location changes
  useEffect(() => {
    setManualMenuSwitch(false);
  }, [location.pathname]);

  // Load all global data once on mount
  useEffect(() => {
    loadGlobalData();
  }, []);

  // Check for new messages on page load/navigation
  useEffect(() => {
    if (user && userMailboxes) {
      checkForNewMessages();
    }
  }, [location.pathname, user, userMailboxes]);

  // Load unread counts when popovers open
  useEffect(() => {
    if (notificationsOpen) {
      loadUnreadNotifications();
    }
  }, [notificationsOpen, user]);

  useEffect(() => {
    if (messagesOpen) {
      loadUnreadMessages();
      setHasNewMessages(false); // Reset animation when messages popover opens
    }
  }, [messagesOpen, user, userMailboxes, userTeamIds]);

  const loadGlobalData = async () => {
    try {
      setIsLoading(true);

      // Load user
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Load user mailboxes
      if (currentUser?.id) {
        const userData = await base44.entities.User.get(currentUser.id);
        setUserMailboxes(userData.mailboxes || []);

        // Load user teams once
        const allTeams = await base44.entities.Team.list();
        const teams = allTeams.filter(t =>
          t.owner_id === currentUser.id ||
          t.members?.some(m => m.user_id === currentUser.id && m.status === "active")
        );
        setUserTeamIds(teams.map(t => t.id));
      }

      // Load platform settings once
      const settings = await base44.entities.SiteSettings.list();
      const name = settings.find(s => s.setting_key === 'platform_name')?.setting_value;
      const subtitle = settings.find(s => s.setting_key === 'platform_subtitle')?.setting_value;
      const icon = settings.find(s => s.setting_key === 'platform_icon')?.setting_value;

      setPlatformSettings({
        name: name || "WPHubPro",
        subtitle: subtitle || "Plugin Management",
        icon: icon || null
      });

      // Load initial counts
      if (currentUser) {
        loadUnreadNotifications();
        loadUnreadMessages();
      }
      loadActiveConnector();

    } catch (error) {
      console.error('Error loading global data:', error);
      setUser(null); // Ensure user is null if there's an error
    } finally {
      setIsLoading(false);
    }
  };

  const loadUnreadNotifications = async () => {
    if (!user) return;
    try {
      const notifications = await base44.entities.Notification.filter({
        recipient_id: user.id,
        is_read: false
      });
      setUnreadCount(notifications.length);
    } catch (error) {
      console.error("Error loading notifications:", error);
    }
  };

  const loadUnreadMessages = async () => {
    if (!user || !userMailboxes) return;

    try {
      const userInboxId = userMailboxes.find(m => m.type === 'userinbox')?.id;
      const adminInboxId = user.role === 'admin' ? userMailboxes.find(m => m.type === 'admininbox')?.id : null;

      let unreadCount = 0;

      // Count unread in user inbox
      if (userInboxId) {
        const userInboxMessages = await base44.entities.Message.filter({
          to_mailbox_id: userInboxId,
          is_read: false
        });
        unreadCount += userInboxMessages.length;
      }

      // Count unread in admin inbox (if admin)
      if (adminInboxId) {
        const adminInboxMessages = await base44.entities.Message.filter({
          to_mailbox_id: adminInboxId,
          is_read: false
        });
        unreadCount += adminInboxMessages.length;
      }

      // Count unread in team inboxes
      if (userTeamIds.length > 0) {
        const allTeams = await base44.entities.Team.list();
        const teamInboxIds = allTeams
          .filter(t => userTeamIds.includes(t.id))
          .map(t => t.inbox_id)
          .filter(id => id);

        for (const inboxId of teamInboxIds) {
          const teamMessages = await base44.entities.Message.filter({
            to_mailbox_id: inboxId,
            is_read: false
          });
          unreadCount += teamMessages.length;
        }
      }

      const previousCount = unreadMessagesCount;
      setUnreadMessagesCount(unreadCount);

      // Trigger animation if count increased
      if (unreadCount > previousCount && previousCount !== null) {
        setHasNewMessages(true);
        setTimeout(() => setHasNewMessages(false), 3000);
      }
    } catch (error) {
      console.error("Error loading unread messages:", error);
    }
  };

  const checkForNewMessages = async () => {
    if (!user || !userMailboxes) return;
    await loadUnreadMessages();
  };

  const loadActiveConnector = async () => {
    try {
      const settings = await base44.entities.SiteSettings.list();
      const activeVersion = settings.find(s => s.setting_key === 'active_connector_version')?.setting_value;

      if (activeVersion) {
        const connectors = await base44.entities.Connector.list();
        const connector = connectors.find(c => c.version === activeVersion);
        setActiveConnector(connector);
      }
    } catch (error) {
      console.error("Error loading connector:", error);
    }
  };

  const { data: notifications = [] } = useQuery({
    queryKey: ['header-notifications', user?.id],
    queryFn: async () => {
      if (!user) return [];
      return base44.entities.Notification.filter({ recipient_id: user.id }, "-created_date", 5);
    },
    enabled: !!user && notificationsOpen,
    staleTime: 0,
    initialData: [],
  });

  const { data: recentActivities = [] } = useQuery({
    queryKey: ['header-activities', user?.email],
    queryFn: async () => {
      if (!user) return [];
      const allActivities = await base44.entities.ActivityLog.filter({ user_email: user.email }, "-created_date", 5);
      return allActivities.filter(activity => activity.entity_type !== "connector");
    },
    enabled: !!user && activityOpen,
    staleTime: 0,
    initialData: [],
  });

  const { data: recentMessages = [] } = useQuery({
    queryKey: ['header-messages', user?.id, userMailboxes],
    queryFn: async () => {
      if (!user || !userMailboxes) return [];

      const userInboxId = userMailboxes.find(m => m.type === 'userinbox')?.id;
      if (!userInboxId) return [];

      // Only fetch messages for user personal inbox - no admin inbox, no team inboxes
      const messages = await base44.entities.Message.filter({
        to_mailbox_id: userInboxId
      }, "-created_date", 5);

      return messages;
    },
    enabled: !!user && !!userMailboxes && messagesOpen,
    staleTime: 0,
    initialData: [],
  });

  const acceptInviteMutation = useMutation({
    mutationFn: async (notification) => {
      if (!notification.team_invite_id) throw new Error('Geen team uitnodiging ID');

      const invites = await base44.entities.TeamInvite.filter({ id: notification.team_invite_id });
      if (invites.length === 0) throw new Error('Uitnodiging niet gevonden');

      const invite = invites[0];
      await base44.entities.TeamInvite.update(invite.id, {
        status: "accepted",
        accepted_at: new Date().toISOString()
      });

      const teams = await base44.entities.Team.filter({ id: invite.team_id });
      if (teams.length === 0) throw new Error("Team niet gevonden");

      const team = teams[0];
      const currentMembers = team.members || [];
      const existingMemberIndex = currentMembers.findIndex(m => m.user_id === user.id);

      let updatedMembers;
      if (existingMemberIndex !== -1) {
        updatedMembers = currentMembers.map((m, index) =>
          index === existingMemberIndex ? { ...m, status: "active" } : m
        );
      } else {
        updatedMembers = [
          ...currentMembers,
          {
            user_id: user.id,
            email: user.email,
            team_role_id: invite.team_role_id,
            status: "active",
            joined_at: new Date().toISOString()
          }
        ];
      }

      await base44.entities.Team.update(team.id, { members: updatedMembers });
      await base44.entities.Notification.update(notification.id, { is_read: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['header-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      loadUnreadNotifications();
      // Re-load user teams to update the userTeamIds state if necessary
      loadGlobalData();
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: (notificationId) =>
      base44.entities.Notification.update(notificationId, { is_read: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['header-notifications'] });
      loadUnreadNotifications();
    },
  });

  const markMessageAsReadMutation = useMutation({
    mutationFn: (messageId) =>
      base44.entities.Message.update(messageId, { is_read: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['header-messages'] });
      loadUnreadMessages();
    },
  });

  const handleLogout = async () => {
    sessionStorage.removeItem('2fa_session_id');
    sessionStorage.removeItem('admin_menu_active');

    if (user?.two_fa_enabled) {
      base44.functions.invoke('reset2FAStatus', {}).catch(err => {
        console.error('Error resetting 2FA status:', err);
      });
    }

    // Supabase logout
    const { supabase } = await import('@/api/supabaseClient');
    await supabase.auth.signOut();
    
    // Redirect naar login
    navigate('/login');
  };

  const isAdmin = user?.role === "admin";

  // User Menu Items
  const myWorkspaceItems = [
    { title: "Sites", url: createPageUrl("Sites"), icon: Globe },
    { title: "Plugins", url: createPageUrl("Plugins"), icon: Package },
    { title: "Themes", url: createPageUrl("Themes"), icon: Palette },
    { title: "Projecten", url: createPageUrl("Projects"), icon: Briefcase },
    { title: "Berichten", url: createPageUrl("UserMessages"), icon: Mail }, // Changed from Messages
    { title: "Mijn Abonnement", url: createPageUrl("MySubscription"), icon: CreditCard }
  ];

  const teamsWorkspaceItems = [
    { title: "Mijn Teams", url: createPageUrl("Teams"), icon: Users }
  ];

  // Admin Menu Items
  const adminMenuItems = [
    { title: "Dashboard", url: createPageUrl("AdminDashboard"), icon: LayoutDashboard },
    { title: "Gebruikers", url: createPageUrl("UserManager"), icon: Users },
  ];

  const adminMessagesItems = [
    { title: "Inbox", url: createPageUrl("AdminMessages"), icon: Inbox }, // Changed from Messages
    { title: "Notifications", url: createPageUrl("AdminNotifications"), icon: Bell }
  ];

  const adminSupportItems = [
    { title: "Support Tickets", url: createPageUrl("AdminSupportTickets"), icon: Ticket }
  ];

  const businessItems = [
    { title: "Plans", url: createPageUrl("SubscriptionPlans"), icon: Package },
    { title: "Plan Groepen", url: createPageUrl("PlanGroups"), icon: Layers },
    { title: "Abonnementen", url: createPageUrl("SubscriptionManager"), icon: Receipt },
    { title: "Financieel", url: createPageUrl("FinanceSettings"), icon: DollarSign }
  ];

  const controlRoomItems = [
    { title: "Settings", url: createPageUrl("SiteSettings"), icon: Settings },
    { title: "Activiteiten", url: createPageUrl("PlatformActivities"), icon: Activity },
    { title: "Tools", url: createPageUrl("PlatformTools"), icon: Wrench }
  ];

  const handleMenuSwitch = (toAdmin) => {
    setManualMenuSwitch(true);
    setIsAdminMenu(toAdmin);
    setSidebarOpen(false);

    // Force immediate navigation
    setTimeout(() => {
      if (toAdmin) {
        navigate(createPageUrl("AdminDashboard"));
      } else {
        navigate(createPageUrl("Dashboard"));
      }
    }, 0);
  };

  const getInitials = (name) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const publicPages = [createPageUrl("Home"), createPageUrl("Pricing"), "/"];
  const authPages = [createPageUrl("TwoFactorAuth")];

  const isPublicPage = publicPages.includes(location.pathname);
  const isAuthPage = authPages.includes(location.pathname);

  if (location.pathname === createPageUrl("Home")) {
    return children;
  }

  if (location.pathname === createPageUrl("Pricing")) {
    return children;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Laden...</p>
        </div>
      </div>
    );
  }

  // Don't block access if user data is still loading - ProtectedRoute already handles auth
  // Just show loading state for user-specific features

  if (user && !isPublicPage && !isAuthPage) {
    if (user.two_fa_enabled) {
      const sessionId = sessionStorage.getItem('2fa_session_id');
      const isVerified = sessionId && sessionId === user.two_fa_verified_session;

      if (!isVerified) {
        window.location.href = createPageUrl("TwoFactorAuth");
        return null;
      }
    }
  }

  if (isAuthPage) {
    return children;
  }

  return (
    <UserContext.Provider value={user}>
      <style>{`
        @keyframes messagesPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }
        .messages-pulse {
          animation: messagesPulse 0.6s ease-in-out 3;
        }
      `}</style>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        {/* Sidebar */}
        {user && (
          <>
            {/* Mobile overlay */}
            {sidebarOpen && (
              <div
                className="fixed inset-0 bg-gray-900/50 z-40 lg:hidden"
                onClick={() => setSidebarOpen(false)}
              />
            )}

            {/* Sidebar */}
            <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 lg:translate-x-0 ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}>
              {/* Logo */}
              <div className="h-20 flex items-center px-6 border-b border-gray-200">
                <Link to={createPageUrl("Home")} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                    {platformSettings.icon ? (
                      <img src={platformSettings.icon} alt={platformSettings.name} className="w-full h-full object-contain rounded-lg" />
                    ) : (
                      <Package className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div>
                    <h1 className="font-bold text-gray-900 text-sm">{platformSettings.name}</h1>
                    <p className="text-xs text-gray-500">{platformSettings.subtitle}</p>
                  </div>
                </Link>
              </div>

              {/* Admin Menu Toggle */}
              {isAdmin && (
                <div className="px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-1">
                    <button
                      onClick={() => handleMenuSwitch(false)}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        !isAdminMenu
                          ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5 inline mr-1.5" />
                      User
                    </button>
                    <button
                      onClick={() => handleMenuSwitch(true)}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        isAdminMenu
                          ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Crown className="w-3.5 h-3.5 inline mr-1.5" />
                      Admin
                    </button>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <ScrollArea className="flex-1 px-4 py-6">
                {!isAdminMenu ? (
                  /* User Menu */
                  <div className="space-y-6">
                    {/* Dashboard - Standalone */}
                    <div>
                      <Link
                        to={createPageUrl("Dashboard")}
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                          location.pathname === createPageUrl("Dashboard")
                            ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/50'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                        onClick={() => setSidebarOpen(false)}
                      >
                        <LayoutDashboard className="w-5 h-5" />
                        <span>Dashboard</span>
                      </Link>
                    </div>

                    {/* My Workspace */}
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-2">
                        Mijn Workspace
                      </p>
                      <nav className="space-y-1">
                        {myWorkspaceItems.map((item) => (
                          <Link
                            key={item.title}
                            to={item.url}
                            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                              location.pathname === item.url
                                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/50'
                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            }`}
                            onClick={() => setSidebarOpen(false)}
                          >
                            <item.icon className="w-5 h-5" />
                            <span>{item.title}</span>
                          </Link>
                        ))}
                      </nav>
                    </div>

                    {/* Teams Workspace */}
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-2">
                        Teams Workspace
                      </p>
                      <nav className="space-y-1">
                        {teamsWorkspaceItems.map((item) => (
                          <Link
                            key={item.title}
                            to={item.url}
                            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                              location.pathname === item.url
                                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/50'
                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            }`}
                            onClick={() => setSidebarOpen(false)}
                          >
                            <item.icon className="w-5 h-5" />
                            <span>{item.title}</span>
                          </Link>
                        ))}
                      </nav>
                    </div>

                    {/* Support Link */}
                    <div className="pt-3 border-t border-gray-200">
                      <Link
                        to={createPageUrl("Support")}
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                          location.pathname === createPageUrl("Support")
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/50'
                            : 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700'
                        }`}
                        onClick={() => setSidebarOpen(false)}
                      >
                        <HelpCircle className="w-5 h-5" />
                        <span>Support & Help</span>
                      </Link>
                    </div>
                  </div>
                ) : (
                  /* Admin Menu */
                  <div className="space-y-6">
                    {/* Main Admin Items */}
                    <div>
                      <nav className="space-y-1">
                        {adminMenuItems.map((item) => (
                          <Link
                            key={item.title}
                            to={item.url}
                            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                              location.pathname === item.url
                                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/50'
                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            }`}
                            onClick={() => setSidebarOpen(false)}
                          >
                            <item.icon className="w-5 h-5" />
                            <span>{item.title}</span>
                          </Link>
                        ))}
                      </nav>
                    </div>

                    {/* Berichten Section */}
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-2">
                        Berichten
                      </p>
                      <nav className="space-y-1">
                        {adminMessagesItems.map((item) => (
                          <Link
                            key={item.title}
                            to={item.url}
                            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                              location.pathname === item.url
                                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/50'
                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            }`}
                            onClick={() => setSidebarOpen(false)}
                          >
                            <item.icon className="w-5 h-5" />
                            <span>{item.title}</span>
                          </Link>
                        ))}
                      </nav>
                    </div>

                    {/* Support Section - NEW */}
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-2">
                        Support
                      </p>
                      <nav className="space-y-1">
                        {adminSupportItems.map((item) => (
                          <Link
                            key={item.title}
                            to={item.url}
                            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                              location.pathname === item.url
                                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/50'
                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            }`}
                            onClick={() => setSidebarOpen(false)}
                          >
                            <item.icon className="w-5 h-5" />
                            <span>{item.title}</span>
                          </Link>
                        ))}
                      </nav>
                    </div>

                    {/* Business Section */}
                    <div>
                      <Collapsible open={businessOpen} onOpenChange={setBusinessOpen}>
                        <CollapsibleTrigger className="w-full flex items-center justify-between px-2 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors">
                          <div className="flex items-center gap-2">
                            <BarChart3 className="w-4 h-4" />
                            Business
                          </div>
                          <ChevronRight className={`w-4 h-4 transition-transform ${businessOpen ? 'rotate-90' : ''}`} />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <nav className="space-y-1 mt-2">
                            {businessItems.map((item) => (
                              <Link
                                key={item.title}
                                to={item.url}
                                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                                  location.pathname === item.url
                                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/50'
                                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                }`}
                                onClick={() => setSidebarOpen(false)}
                              >
                                <item.icon className="w-5 h-5" />
                                <span>{item.title}</span>
                              </Link>
                            ))}
                          </nav>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>

                    {/* Control Room Section */}
                    <div>
                      <Collapsible open={controlRoomOpen} onOpenChange={setControlRoomOpen}>
                        <CollapsibleTrigger className="w-full flex items-center justify-between px-2 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors">
                          <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4" />
                            Control Room
                          </div>
                          <ChevronRight className={`w-4 h-4 transition-transform ${controlRoomOpen ? 'rotate-90' : ''}`} />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <nav className="space-y-1 mt-2">
                            {controlRoomItems.map((item) => (
                              <Link
                                key={item.title}
                                to={item.url}
                                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                                  location.pathname === item.url
                                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/50'
                                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                }`}
                                onClick={() => setSidebarOpen(false)}
                              >
                                <item.icon className="w-5 h-5" />
                                <span>{item.title}</span>
                              </Link>
                            ))}
                          </nav>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  </div>
                )}
              </ScrollArea>

              {/* Connector Card - Only show in User menu */}
              {!isAdminMenu && activeConnector && (
                <div className="p-4 border-t border-gray-200">
                  <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-4 border border-indigo-100">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <Package className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm text-gray-900">Connector</h3>
                        <p className="text-xs text-gray-500">v{activeConnector.version}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (activeConnector && activeConnector.file_url) {
                          try {
                            const response = await fetch(activeConnector.file_url);
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = `wp-plugin-hub-connector-v${activeConnector.version}.zip`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            window.URL.revokeObjectURL(url);
                          } catch (error) {
                            console.error('Error downloading connector:', error);
                            window.open(activeConnector.file_url, '_blank');
                          }
                        }
                      }}
                      className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0"
                    >
                      <Download className="w-3 h-3 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              )}
            </aside>
          </>
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="h-20 bg-white border-b border-gray-200 flex items-center justify-between px-6">
            <div className="flex items-center gap-4">
              {user && (
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Menu className="w-5 h-5 text-gray-600" />
                </button>
              )}
              <div>
                <h2 className="text-xl font-bold text-gray-900">{currentPageName}</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {format(new Date(), "EEEE, d MMMM yyyy", { locale: nl })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {user && (
                <>
                  {/* Search */}
                  <div className="hidden md:flex items-center gap-2 bg-gray-50 rounded-full px-4 py-2 mr-2">
                    <Search className="w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Zoeken..."
                      className="bg-transparent border-none focus:outline-none text-sm text-gray-600 w-48"
                    />
                  </div>

                  {/* Activity Icon */}
                  <Popover open={activityOpen} onOpenChange={setActivityOpen}>
                    <PopoverTrigger asChild>
                      <button className="relative p-2.5 hover:bg-gray-100 rounded-xl transition-colors">
                        <Activity className="w-5 h-5 text-gray-600" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0 bg-white rounded-2xl shadow-xl border-gray-200" align="end">
                      <div className="p-4 border-b border-gray-100">
                        <h3 className="font-semibold text-gray-900">Recente Activiteiten</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Jouw laatste acties</p>
                      </div>
                      <ScrollArea className="h-80">
                        <div className="p-2">
                          {recentActivities.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">
                              <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                              <p className="text-sm">Nog geen activiteiten</p>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {recentActivities.map((activity) => (
                                <div
                                  key={activity.id}
                                  className="p-3 rounded-xl hover:bg-gray-50 transition-colors"
                                >
                                  <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                                  {activity.details && (
                                    <p className="text-xs text-gray-600 mt-1">{activity.details}</p>
                                  )}
                                  <p className="text-xs text-gray-400 mt-1">
                                    {format(new Date(activity.created_date), "d MMM HH:mm", { locale: nl })}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>

                  {/* Messages */}
                  <Popover open={messagesOpen} onOpenChange={setMessagesOpen}>
                    <PopoverTrigger asChild>
                      <button className={`relative p-2.5 hover:bg-gray-100 rounded-xl transition-colors ${hasNewMessages ? 'messages-pulse' : ''}`}>
                        <Mail className="w-5 h-5 text-gray-600" />
                        {unreadMessagesCount > 0 && (
                          <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center">
                            <span className={`absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75 ${hasNewMessages ? 'animate-ping' : ''}`}></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                          </span>
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0 bg-white rounded-2xl shadow-xl border-gray-200" align="end">
                      <div className="p-4 border-b border-gray-100">
                        <h3 className="font-semibold text-gray-900">Berichten</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{unreadMessagesCount} ongelezen</p>
                      </div>
                      <ScrollArea className="h-80">
                        {recentMessages.length === 0 ? (
                          <div className="text-center py-12 text-gray-400">
                            <Mail className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">Geen berichten</p>
                          </div>
                        ) : (
                          <div className="p-2">
                            {recentMessages.map((message) => (
                              <div
                                key={message.id}
                                className={`p-3 rounded-xl mb-2 cursor-pointer transition-colors ${
                                  message.is_read ? 'hover:bg-gray-50' : 'bg-indigo-50 hover:bg-indigo-100'
                                }`}
                                onClick={() => {
                                  if (!message.is_read) {
                                    markMessageAsReadMutation.mutate(message.id);
                                  }
                                  setMessagesOpen(false);
                                  window.location.href = createPageUrl("UserMessages");
                                }}
                              >
                                <p className="text-sm font-medium text-gray-900">{message.subject}</p>
                                <p className="text-xs text-gray-600 mt-1 line-clamp-2">{message.message}</p>
                                <p className="text-xs text-gray-400 mt-1">
                                  {format(new Date(message.created_date), "d MMM HH:mm", { locale: nl })}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                      <div className="p-3 border-t border-gray-100">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs"
                          asChild
                        >
                          <Link to={createPageUrl("UserMessages")}>
                            Alles bekijken
                          </Link>
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Notifications */}
                  <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
                    <PopoverTrigger asChild>
                      <button className="relative p-2.5 hover:bg-gray-100 rounded-xl transition-colors">
                        <Bell className="w-5 h-5 text-gray-600" />
                        {unreadCount > 0 && (
                          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0 bg-white rounded-2xl shadow-xl border-gray-200" align="end">
                      <div className="p-4 border-b border-gray-100">
                        <h3 className="font-semibold text-gray-900">Notificaties</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{unreadCount} ongelezen</p>
                      </div>
                      <ScrollArea className="h-80">
                        {notifications.length === 0 ? (
                          <div className="text-center py-12 text-gray-400">
                            <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">Geen notificaties</p>
                          </div>
                        ) : (
                          <div className="p-2">
                            {notifications.map((notification) => (
                              <div
                                key={notification.id}
                                className={`p-3 rounded-xl mb-2 ${
                                  notification.is_read ? '' : 'bg-amber-50'
                                }`}
                              >
                                <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                                <p className="text-xs text-gray-600 mt-1">{notification.message}</p>
                                <p className="text-xs text-gray-400 mt-1">
                                  {format(new Date(notification.created_date), "d MMM HH:mm", { locale: nl })}
                                </p>
                                {notification.type === "team_invite" && !notification.is_read && (
                                  <div className="flex gap-2 mt-2">
                                    <Button
                                      size="sm"
                                      onClick={() => acceptInviteMutation.mutate(notification)}
                                      className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0"
                                    >
                                      Accepteren
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => markAsReadMutation.mutate(notification.id)}
                                    >
                                      Negeren
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>

                  {/* User Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded-xl transition-colors ml-2">
                        <Avatar className="w-9 h-9 border-2 border-gray-200">
                          <AvatarImage src={user?.avatar_url} />
                          <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xs font-semibold">
                            {getInitials(user?.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="text-left hidden xl:block">
                          <p className="text-sm font-semibold text-gray-900 flex items-center gap-1">
                            {user?.full_name || "Gebruiker"}
                            {isAdmin && <Crown className="w-3 h-3 text-amber-500" />}
                          </p>
                          <p className="text-xs text-gray-500">Admin</p>
                        </div>
                        <ChevronDown className="w-4 h-4 text-gray-400 hidden xl:block" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 bg-white rounded-2xl shadow-xl border-gray-200">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="font-semibold text-sm text-gray-900">{user?.full_name || "Gebruiker"}</p>
                        <p className="text-xs text-gray-500">{user?.email}</p>
                      </div>
                      <DropdownMenuItem asChild>
                        <Link to={createPageUrl("AccountSettings")} className="cursor-pointer">
                          <Settings className="w-4 h-4 mr-2" />
                          Account Instellingen
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer">
                        <LogOut className="w-4 h-4 mr-2" />
                        Uitloggen
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>

        {/* AI Chat Agent - Only show when user is logged in */}
        {user && !isPublicPage && !isAuthPage && (
          <AIChatAgent user={user} currentPageName={currentPageName} />
        )}
      </div>
    </UserContext.Provider>
  );
}