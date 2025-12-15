import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";
import { Skeleton } from "./ui/skeleton";
import { Trophy, Target, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface SkillCategory {
  id: string;
  category_name: string;
  total_time_minutes: number;
}

const SKILL_LEVELS = {
  BEGINNER: { hours: 20, label: "Anfänger", icon: Sparkles },
  INTERMEDIATE: { hours: 100, label: "Verständnis", icon: Target },
  EXPERT: { hours: 10000, label: "Experte", icon: Trophy },
};

export const SkillProgress = () => {
  const { user } = useAuth();

  const { data: categories, isLoading } = useQuery({
    queryKey: ["skill-categories", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("skill_categories")
        .select("*")
        .eq("user_id", user.id)
        .order("total_time_minutes", { ascending: false });

      if (error) throw error;
      return data as SkillCategory[];
    },
    enabled: !!user,
  });

  const getSkillLevel = (minutes: number) => {
    const hours = minutes / 60;
    if (hours < SKILL_LEVELS.BEGINNER.hours) {
      return {
        current: "Lernend",
        next: SKILL_LEVELS.BEGINNER,
        progress: (hours / SKILL_LEVELS.BEGINNER.hours) * 100,
        hoursToNext: SKILL_LEVELS.BEGINNER.hours - hours,
      };
    } else if (hours < SKILL_LEVELS.INTERMEDIATE.hours) {
      return {
        current: SKILL_LEVELS.BEGINNER.label,
        next: SKILL_LEVELS.INTERMEDIATE,
        progress: ((hours - SKILL_LEVELS.BEGINNER.hours) / (SKILL_LEVELS.INTERMEDIATE.hours - SKILL_LEVELS.BEGINNER.hours)) * 100,
        hoursToNext: SKILL_LEVELS.INTERMEDIATE.hours - hours,
      };
    } else if (hours < SKILL_LEVELS.EXPERT.hours) {
      return {
        current: SKILL_LEVELS.INTERMEDIATE.label,
        next: SKILL_LEVELS.EXPERT,
        progress: ((hours - SKILL_LEVELS.INTERMEDIATE.hours) / (SKILL_LEVELS.EXPERT.hours - SKILL_LEVELS.INTERMEDIATE.hours)) * 100,
        hoursToNext: SKILL_LEVELS.EXPERT.hours - hours,
      };
    }
    return {
      current: SKILL_LEVELS.EXPERT.label,
      next: null,
      progress: 100,
      hoursToNext: 0,
    };
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    );
  }

  if (!categories || categories.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <p>Keine Skill-Kategorien gefunden</p>
          <p className="text-sm mt-2">Schaue Videos, damit die KI Kategorien erstellen kann</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {categories.map((category) => {
        const skillLevel = getSkillLevel(category.total_time_minutes);
        const hours = Math.floor(category.total_time_minutes / 60);
        const minutes = category.total_time_minutes % 60;
        const Icon = skillLevel.next?.icon || Trophy;

        return (
          <Card key={category.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{category.category_name}</CardTitle>
                <Icon className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Aktuell</span>
                  <span className="font-medium">{skillLevel.current}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {hours}h {minutes}m investiert
                </div>
              </div>

              {skillLevel.next && (
                <>
                  <Progress value={skillLevel.progress} className="h-2" />
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Nächstes Level</span>
                      <span className="font-medium">{skillLevel.next.label}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Noch {Math.ceil(skillLevel.hoursToNext)}h bis {skillLevel.next.label}
                    </div>
                  </div>
                </>
              )}

              {skillLevel.current === SKILL_LEVELS.EXPERT.label && (
                <div className="text-sm text-green-600 dark:text-green-400 font-medium">
                  🎉 Experten-Level erreicht!
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};