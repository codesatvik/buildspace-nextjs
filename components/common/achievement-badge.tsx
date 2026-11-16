import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, Lock } from "lucide-react";

interface AchievementBadgeProps {
  id: string;
  title: string;
  description: string;
  points: number;
  earned: boolean;
  icon?: string;
}

export function AchievementBadge({ title, description, points, earned, icon }: AchievementBadgeProps) {
  return (
    <Card className={earned ? "border-yellow-300 bg-yellow-50" : "opacity-60"}>
      <CardContent className="pt-6 flex items-start gap-4">
        <div className={`p-2 rounded-full ${earned ? "bg-yellow-100" : "bg-gray-100"}`}>
          {earned ? (
            <Award className="h-6 w-6 text-yellow-500" />
          ) : (
            <Lock className="h-6 w-6 text-gray-400" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <p className="font-semibold">{title}</p>
            <Badge variant={earned ? "default" : "secondary"}>{points} XP</Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
