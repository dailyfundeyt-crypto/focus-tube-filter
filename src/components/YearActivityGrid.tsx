import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "./ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

interface DailyActivity {
  activity_date: string;
  total_watch_time_minutes: number;
  videos_watched: number;
}

export const YearActivityGrid = () => {
  const { data: activities, isLoading } = useQuery({
    queryKey: ["year-activity"],
    queryFn: async () => {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const { data, error } = await supabase
        .from("daily_activity")
        .select("*")
        .gte("activity_date", oneYearAgo.toISOString().split("T")[0])
        .order("activity_date");

      if (error) throw error;
      return data as DailyActivity[];
    },
  });

  const generateYearGrid = () => {
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    // Start from the first Sunday before one year ago
    const startDate = new Date(oneYearAgo);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    
    const weeks: Date[][] = [];
    let currentWeek: Date[] = [];
    let currentDate = new Date(startDate);

    while (currentDate <= today) {
      currentWeek.push(new Date(currentDate));
      
      if (currentDate.getDay() === 6 || currentDate >= today) {
        weeks.push([...currentWeek]);
        currentWeek = [];
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return weeks;
  };

  const getActivityLevel = (date: Date): number => {
    if (!activities) return 0;
    
    const dateStr = date.toISOString().split("T")[0];
    const activity = activities.find((a) => a.activity_date === dateStr);
    
    if (!activity || activity.total_watch_time_minutes === 0) return 0;
    if (activity.total_watch_time_minutes < 30) return 1;
    if (activity.total_watch_time_minutes < 60) return 2;
    if (activity.total_watch_time_minutes < 120) return 3;
    return 4;
  };

  const getActivityColor = (level: number): string => {
    const colors = {
      0: "bg-muted/30",
      1: "bg-primary/20",
      2: "bg-primary/40",
      3: "bg-primary/60",
      4: "bg-primary/80",
    };
    return colors[level as keyof typeof colors] || colors[0];
  };

  const getActivityData = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    return activities?.find((a) => a.activity_date === dateStr);
  };

  if (isLoading) {
    return <Skeleton className="h-32 w-full" />;
  }

  const weeks = generateYearGrid();
  const totalVideos = activities?.reduce((sum, a) => sum + a.videos_watched, 0) || 0;
  const totalMinutes = activities?.reduce((sum, a) => sum + a.total_watch_time_minutes, 0) || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Jahresaktivität</h3>
        <div className="text-sm text-muted-foreground">
          {totalVideos} Videos · {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m
        </div>
      </div>
      
      <TooltipProvider>
        <div className="overflow-x-auto">
          <div className="inline-flex gap-1">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-1">
                {week.map((date, dayIndex) => {
                  const level = getActivityLevel(date);
                  const activityData = getActivityData(date);
                  const isFuture = date > new Date();
                  
                  return (
                    <Tooltip key={dayIndex}>
                      <TooltipTrigger asChild>
                        <div
                          className={`w-3 h-3 rounded-sm transition-colors ${
                            isFuture ? "bg-muted/10" : getActivityColor(level)
                          }`}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-xs">
                          <div className="font-semibold">
                            {date.toLocaleDateString("de-DE", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                          {activityData ? (
                            <>
                              <div>{activityData.videos_watched} Videos</div>
                              <div>{activityData.total_watch_time_minutes} Minuten</div>
                            </>
                          ) : (
                            <div className="text-muted-foreground">Keine Aktivität</div>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </TooltipProvider>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Weniger</span>
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4].map((level) => (
            <div key={level} className={`w-3 h-3 rounded-sm ${getActivityColor(level)}`} />
          ))}
        </div>
        <span>Mehr</span>
      </div>
    </div>
  );
};