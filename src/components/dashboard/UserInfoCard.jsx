import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, User, Building, Mail } from "lucide-react";

export default function UserInfoCard({ user }) {
  if (!user) return null;

  const getInitials = (name) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <Card className="border-none shadow-md">
      <CardContent className="p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wider">
          Profiel Informatie
        </h3>
        
        <div className="flex items-start gap-4">
          <Avatar className="w-16 h-16 border-2 border-gray-200">
            <AvatarImage src={user.avatar_url} />
            <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-semibold text-lg">
              {getInitials(user.full_name)}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-bold text-gray-900">{user.full_name || "Gebruiker"}</h4>
                {user.role === "admin" && (
                  <Badge className="bg-purple-100 text-purple-700">
                    <Crown className="w-3 h-3 mr-1" />
                    Admin
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Mail className="w-4 h-4" />
                <span>{user.email}</span>
              </div>
            </div>

            {user.company && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Building className="w-4 h-4" />
                <span>{user.company}</span>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-gray-500">
              <User className="w-3.5 h-3.5" />
              <span>Lid sinds {new Date(user.created_date).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}