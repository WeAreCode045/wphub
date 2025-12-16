import { Card, CardContent } from "@/components/ui/card";
import { Package, Globe, HardDrive, Cloud } from "lucide-react";

export default function StatsOverview({ pluginsCount, localPluginsCount, remotePluginsCount, sitesCount }) {
  const stats = [
    {
      title: "Totaal Plugins",
      value: pluginsCount,
      icon: Package,
      gradient: "from-indigo-500 to-purple-600",
      bgGradient: "from-indigo-50 to-purple-50",
      iconBg: "bg-gradient-to-br from-indigo-500 to-purple-600",
      subStats: [
        { label: "Local", value: localPluginsCount, icon: HardDrive, color: "text-indigo-600" },
        { label: "Remote", value: remotePluginsCount, icon: Cloud, color: "text-purple-600" }
      ]
    },
    {
      title: "Verbonden Sites",
      value: sitesCount,
      icon: Globe,
      gradient: "from-indigo-500 to-purple-600",
      bgGradient: "from-indigo-50 to-purple-50",
      iconBg: "bg-gradient-to-br from-indigo-500 to-purple-600"
    }
  ];

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {stats.map((stat, index) => (
        <Card key={index} className="border-0 shadow-lg rounded-2xl overflow-hidden hover:shadow-xl transition-shadow duration-300">
          <CardContent className={`p-6 bg-gradient-to-br ${stat.bgGradient}`}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">{stat.title}</p>
                <p className="text-4xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className={`w-16 h-16 ${stat.iconBg} rounded-2xl flex items-center justify-center shadow-lg`}>
                <stat.icon className="w-8 h-8 text-white" />
              </div>
            </div>
            {stat.subStats && (
              <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-200/50">
                {stat.subStats.map((subStat, idx) => (
                  <div key={idx} className="bg-white/60 backdrop-blur-sm rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <subStat.icon className={`w-4 h-4 ${subStat.color}`} />
                      <p className="text-xs text-gray-600">{subStat.label}</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{subStat.value}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}