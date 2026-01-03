import Dashboard from './pages/Dashboard';
import Sites from './pages/Sites';
import SiteDetail from './pages/SiteDetail';
import Plugins from './pages/Plugins';
import PluginDetail from './pages/PluginDetail';
import UserManager from './pages/UserManager';
import AccountSettings from './pages/AccountSettings';
import SiteSettings from './pages/SiteSettings';
import UserDetail from './pages/UserDetail';
import AdminDashboard from './pages/AdminDashboard';
import ConnectorManagement from './pages/ConnectorManagement';
import PlatformActivities from './pages/PlatformActivities';
import Teams from './pages/Teams';
import TeamDetail from './pages/TeamDetail';
import TeamSettings from './pages/TeamSettings';
import RoleManager from './pages/RoleManager';
import TeamRoles from './pages/TeamRoles';
import PlatformTools from './pages/PlatformTools';
import Messages from './pages/Messages';
import TwoFactorAuth from './pages/TwoFactorAuth';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import ProjectTemplates from './pages/ProjectTemplates';
import Pricing from './pages/Pricing';
import AdminNotifications from './pages/AdminNotifications';
import FinanceSettings from './pages/FinanceSettings';
import UserMessages from './pages/UserMessages';
import AdminMessages from './pages/AdminMessages';
import Home from './pages/Home';
import ProfileInfo from './pages/ProfileInfo';
import Support from './pages/Support';
import AdminSupportTickets from './pages/AdminSupportTickets';
import Themes from './pages/Themes';
import ThemeDetail from './pages/ThemeDetail';
import Login from './pages/Login';
import BillingAccount from './pages/BillingAccount';
import SubscriptionOverview from './pages/SubscriptionOverview';
import ProductManagement from './pages/ProductManagement';
import Checkout from './pages/Checkout';
import CheckoutReturn from './pages/CheckoutReturn';
import AdminSubscriptionDashboard from './pages/AdminSubscriptionDashboard';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Sites": Sites,
    "SiteDetail": SiteDetail,
    "Plugins": Plugins,
    "PluginDetail": PluginDetail,
    "UserManager": UserManager,
    "AccountSettings": AccountSettings,
    "BillingAccount": BillingAccount,
    "SiteSettings": SiteSettings,
    "UserDetail": UserDetail,
    "AdminDashboard": AdminDashboard,
    "ConnectorManagement": ConnectorManagement,
    "PlatformActivities": PlatformActivities,
    "Teams": Teams,
    "TeamDetail": TeamDetail,
    "TeamSettings": TeamSettings,
    "RoleManager": RoleManager,
    "TeamRoles": TeamRoles,
    "PlatformTools": PlatformTools,
    "Messages": Messages,
    "TwoFactorAuth": TwoFactorAuth,
    "Projects": Projects,
    "ProjectDetail": ProjectDetail,
    "ProjectTemplates": ProjectTemplates,
    "Pricing": Pricing,
    "AdminNotifications": AdminNotifications,
    "FinanceSettings": FinanceSettings,
    "UserMessages": UserMessages,
    "AdminMessages": AdminMessages,
    "Home": Home,
    "ProfileInfo": ProfileInfo,
    "Support": Support,
    "AdminSupportTickets": AdminSupportTickets,
    "Themes": Themes,
    "ThemeDetail": ThemeDetail,
    "Login": Login,
    "BillingAccount": BillingAccount,
    "SubscriptionOverview": SubscriptionOverview,
    "ProductManagement": ProductManagement,
    "Checkout": Checkout,
    "CheckoutReturn": CheckoutReturn,
    "AdminSubscriptionDashboard": AdminSubscriptionDashboard,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};