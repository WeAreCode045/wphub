import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, User, Building, Mail } from "lucide-react";

export default function ProfileSubscriptionCard({ user }) {
  const getInitials = (name) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  if (!user) return null;

  return (
    <Card className="border-none shadow-lg bg-gradient-to-br from-indigo-500 to-purple-600">
      <CardContent className="p-5">
        {/* Welcome Message */}
        <div className="mb-4 pb-4 border-b border-white/20">
          <h1 className="text-2xl font-bold text-white mb-1">
            Welkom terug, {user?.full_name?.split(" ")[0] || "Gebruiker"} 👋
          </h1>
          <p className="text-sm text-white/80">Hier is een overzicht van je platform activiteiten</p>
        </div>

        {/* Profile Section */}
        <div className="flex items-start gap-3">
          <Avatar className="w-14 h-14 border-2 border-white/30">
            <AvatarImage src={user.avatar_url} />
            <AvatarFallback className="bg-white/20 backdrop-blur-sm text-white font-semibold text-lg">
              {getInitials(user.full_name)}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 space-y-1.5">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h4 className="font-bold text-lg text-white">{user.full_name || "Gebruiker"}</h4>
                {user.role === "admin" && (
                  <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 text-xs">
                    <Crown className="w-3 h-3 mr-1" />
                    Admin
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-white/80">
                <Mail className="w-3.5 h-3.5" />
                <span>{user.email}</span>
              </div>
            </div>

            {user.company && (
              <div className="flex items-center gap-1.5 text-xs text-white/80">
                <Building className="w-3.5 h-3.5" />
                <span>{user.company}</span>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-xs text-white/70">
              <User className="w-3 h-3" />
              <span>Lid sinds {new Date(user.created_date).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}