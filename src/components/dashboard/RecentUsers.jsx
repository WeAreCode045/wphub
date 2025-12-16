import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

export default function RecentUsers({ users }) {
  const getInitials = (name) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <Card className="border-none shadow-lg">
      <CardHeader className="border-b border-gray-100 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" />
            Recent Toegevoegde Gebruikers
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to={createPageUrl("UserManager")}>
              Bekijk alle <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {users.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nog geen gebruikers</p>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <div 
                key={user.id}
                className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-all duration-200 border border-gray-100"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10 border-2 border-purple-100">
                    <AvatarImage src={user.avatar_url} />
                    <AvatarFallback className="bg-purple-100 text-purple-700 font-semibold">
                      {getInitials(user.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-gray-900">{user.full_name}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                </div>
                <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                  {user.role}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}