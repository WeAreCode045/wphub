import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import ProfileSubscriptionCard from "../components/dashboard/ProfileSubscriptionCard";
import AccountUsageCard from "../components/dashboard/AccountUsageCard";
import PluginSiteOverview from "../components/dashboard/PluginSiteOverview";
import TeamProjectOverview from "../components/dashboard/TeamProjectOverview";
import { useUser } from "../Layout";

export default function Dashboard() {
  const user = useUser();

  const { data: plugins = [] } = useQuery({
    queryKey: ['plugins', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const userPlugins = await base44.entities.Plugin.filter({
        owner_type: "user",
        owner_id: user.id
      }, "-updated_date");
      
      return userPlugins;
    },
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: true,
    initialData: [],
  });

  const { data: sites = [] } = useQuery({
    queryKey: ['sites', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const userSites = await base44.entities.Site.filter({
        owner_type: "user",
        owner_id: user.id
      }, "-updated_date");
      
      return userSites;
    },
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: true,
    initialData: [],
  });

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-full">
      <div className="max-w-7xl mx-auto">
        {/* Profile Card & Subscription Usage Card */}
        {user && (
          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            <ProfileSubscriptionCard user={user} />
            <AccountUsageCard userId={user.id} />
          </div>
        )}

        {/* Plugin & Site Overview + Team & Project Overview */}
        <div className="grid lg:grid-cols-2 gap-6">
          <PluginSiteOverview plugins={plugins} sites={sites} allPlugins={plugins} />
          <TeamProjectOverview userId={user?.id} />
        </div>
      </div>
    </div>
  );
}