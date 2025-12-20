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

  const getMonthLabels = (weeks: Date[][]) => {
    const months: { label: string; startWeek: number }[] = [];
    let lastMonth = -1;

    weeks.forEach((week, weekIndex) => {
      const firstDayOfWeek = week[0];
      const month = firstDayOfWeek.getMonth();
      
      if (month !== lastMonth) {
        months.push({
          label: firstDayOfWeek.toLocaleDateString("de-DE", { month: "short" }),
          startWeek: weekIndex,
        });
        lastMonth = month;
      }
    });

    return months;
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
      0: "bg-muted/50 dark:bg-muted/30",
      1: "bg-emerald-200 dark:bg-emerald-900/60",
      2: "bg-emerald-400 dark:bg-emerald-700",
      3: "bg-emerald-500 dark:bg-emerald-500",
      4: "bg-emerald-600 dark:bg-emerald-400",
    };
    return colors[level as keyof typeof colors] || colors[0];
  };

  const getActivityData = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    return activities?.find((a) => a.activity_date === dateStr);
  };

  if (isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  const weeks = generateYearGrid();
  const monthLabels = getMonthLabels(weeks);
  const totalVideos = activities?.reduce((sum, a) => sum + a.videos_watched, 0) || 0;
  const totalMinutes = activities?.reduce((sum, a) => sum + a.total_watch_time_minutes, 0) || 0;
  const activeDays = activities?.filter(a => a.total_watch_time_minutes > 0).length || 0;

  const dayLabels = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">Jahresaktivität</h3>
          <p className="text-sm text-muted-foreground">{activeDays} aktive Tage im letzten Jahr</p>
        </div>
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Videos:</span>
            <span className="font-medium">{totalVideos}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Zeit:</span>
            <span className="font-medium">{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</span>
          </div>
        </div>
      </div>
      
      <TooltipProvider>
        <div className="overflow-x-auto pb-2">
          {/* Month labels */}
          <div className="flex mb-2 ml-8">
            {monthLabels.map((month, index) => (
              <div
                key={index}
                className="text-xs text-muted-foreground"
                style={{
                  position: "relative",
                  left: `${month.startWeek * 14}px`,
                  marginRight: index < monthLabels.length - 1 
                    ? `${(monthLabels[index + 1]?.startWeek - month.startWeek) * 14 - 30}px`
                    : 0,
                }}
              >
                {month.label}
              </div>
            ))}
          </div>
          
          <div className="flex">
            {/* Day labels */}
            <div className="flex flex-col gap-[3px] mr-2 text-xs text-muted-foreground">
              {dayLabels.map((day, index) => (
                <div key={index} className="h-[12px] flex items-center justify-end w-5">
                  {index % 2 === 1 ? day : ""}
                </div>
              ))}
            </div>
            
            {/* Grid */}
            <div className="inline-flex gap-[3px]">
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-[3px]">
                  {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
                    const date = week[dayIndex];
                    if (!date) {
                      return <div key={dayIndex} className="w-[12px] h-[12px]" />;
                    }
                    
                    const level = getActivityLevel(date);
                    const activityData = getActivityData(date);
                    const isFuture = date > new Date();
                    
                    return (
                      <Tooltip key={dayIndex}>
                        <TooltipTrigger asChild>
                          <div
                            className={`w-[12px] h-[12px] rounded-sm transition-all hover:ring-2 hover:ring-foreground/20 ${
                              isFuture ? "bg-transparent" : getActivityColor(level)
                            }`}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-xs">
                            <div className="font-semibold">
                              {date.toLocaleDateString("de-DE", {
                                weekday: "long",
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })}
                            </div>
                            {activityData ? (
                              <div className="mt-1 space-y-0.5">
                                <div>{activityData.videos_watched} Video{activityData.videos_watched !== 1 ? "s" : ""}</div>
                                <div>{activityData.total_watch_time_minutes} Minuten</div>
                              </div>
                            ) : (
                              <div className="text-muted-foreground mt-1">Keine Aktivität</div>
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
        </div>
      </TooltipProvider>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Weniger</span>
          <div className="flex gap-[3px]">
            {[0, 1, 2, 3, 4].map((level) => (
              <div key={level} className={`w-[12px] h-[12px] rounded-sm ${getActivityColor(level)}`} />
            ))}
          </div>
          <span>Mehr</span>
        </div>
        <div className="text-xs text-muted-foreground">
          Letztes Jahr
        </div>
      </div>
    </div>
  );
};
