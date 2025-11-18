import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";

export const useTrackWatchedVideo = () => {
  const { toast } = useToast();

  const trackVideo = useCallback(async (
    videoId: string,
    channelId: string,
    videoTitle: string,
    channelName: string,
    durationMinutes: number
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date().toISOString().split("T")[0];

      // Get category from AI
      const { data: categoryData, error: categoryError } = await supabase.functions.invoke(
        "categorize-video",
        {
          body: { videoTitle, channelName },
        }
      );

      const category = categoryData?.category || "Allgemein";
      console.log("Video categorized as:", category);

      // Update or create skill category
      const { data: existingCategory } = await supabase
        .from("skill_categories")
        .select("*")
        .eq("user_id", user.id)
        .eq("category_name", category)
        .single();

      if (existingCategory) {
        await supabase
          .from("skill_categories")
          .update({
            total_time_minutes: existingCategory.total_time_minutes + durationMinutes,
          })
          .eq("id", existingCategory.id);
      } else {
        await supabase.from("skill_categories").insert({
          user_id: user.id,
          category_name: category,
          total_time_minutes: durationMinutes,
        });
      }

      // Update daily activity
      const { data: existingActivity } = await supabase
        .from("daily_activity")
        .select("*")
        .eq("user_id", user.id)
        .eq("activity_date", today)
        .single();

      if (existingActivity) {
        await supabase
          .from("daily_activity")
          .update({
            total_watch_time_minutes: existingActivity.total_watch_time_minutes + durationMinutes,
            videos_watched: existingActivity.videos_watched + 1,
          })
          .eq("id", existingActivity.id);
      } else {
        await supabase.from("daily_activity").insert({
          user_id: user.id,
          activity_date: today,
          total_watch_time_minutes: durationMinutes,
          videos_watched: 1,
        });
      }

      // Record watched video
      await supabase.from("watched_videos").insert({
        user_id: user.id,
        video_id: videoId,
        channel_id: channelId,
      });

      toast({
        title: "Video getrackt!",
        description: `Kategorie: ${category} (+${durationMinutes} min)`,
      });
    } catch (error) {
      console.error("Error tracking video:", error);
    }
  }, [toast]);

  return { trackVideo };
};