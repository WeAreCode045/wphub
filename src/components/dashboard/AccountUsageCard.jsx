import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function AccountUsageCard({ userId }) {
  return (
    <Card className="border-none shadow-md">
      <CardContent className="p-6">
        <div className="text-center py-8 text-gray-400">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Abonnementsinformatie niet beschikbaar</p>
        </div>
      </CardContent>
    </Card>
  );
}
