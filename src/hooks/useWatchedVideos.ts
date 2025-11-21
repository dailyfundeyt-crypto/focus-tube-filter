import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useWatchedVideos = (channelId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch watched videos for this channel
  const { data: watchedVideos = [] } = useQuery({
    queryKey: ["watched-videos", user?.id, channelId],
    queryFn: async () => {
      if (!user?.id) return [];
      
      let query = supabase
        .from("watched_videos")
        .select("*")
        .eq("user_id", user.id);
      
      if (channelId) {
        query = query.eq("channel_id", channelId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Mark as watched mutation
  const markAsWatchedMutation = useMutation({
    mutationFn: async ({ 
      videoId, 
      channelId,
      olderVideoIds = [],
      durationMinutes 
    }: { 
      videoId: string; 
      channelId: string;
      olderVideoIds?: string[];
      durationMinutes: number;
    }) => {
      if (!user?.id) throw new Error("Not authenticated");

      const videosToMark = [...olderVideoIds, videoId];
      
      // Track each video with its duration
      const { data: cachedVideos } = await supabase
        .from("cached_videos")
        .select("video_id, duration_seconds, channel_id")
        .eq("channel_id", channelId)
        .in("video_id", videosToMark);

      if (cachedVideos) {
        const trackVideoPromises = cachedVideos.map(async (video) => {
          const minutes = Math.ceil((video.duration_seconds || 0) / 60);
          
          // Track the video time to category
          const { data: channelData } = await supabase
            .from("youtube_channels")
            .select("category")
            .eq("channel_id", video.channel_id)
            .maybeSingle();

          const category = channelData?.category || "Allgemein";

          // Update skill category
          const { data: existingCategory } = await supabase
            .from("skill_categories")
            .select("*")
            .eq("user_id", user.id)
            .eq("category_name", category)
            .maybeSingle();

          if (existingCategory) {
            await supabase
              .from("skill_categories")
              .update({
                total_time_minutes: existingCategory.total_time_minutes + minutes,
              })
              .eq("id", existingCategory.id);
          } else {
            await supabase.from("skill_categories").insert({
              user_id: user.id,
              category_name: category,
              total_time_minutes: minutes,
            });
          }

          // Update daily activity
          const today = new Date().toISOString().split("T")[0];
          const { data: existingActivity } = await supabase
            .from("daily_activity")
            .select("*")
            .eq("user_id", user.id)
            .eq("activity_date", today)
            .maybeSingle();

          if (existingActivity) {
            await supabase
              .from("daily_activity")
              .update({
                total_watch_time_minutes: existingActivity.total_watch_time_minutes + minutes,
                videos_watched: existingActivity.videos_watched + 1,
              })
              .eq("id", existingActivity.id);
          } else {
            await supabase.from("daily_activity").insert({
              user_id: user.id,
              activity_date: today,
              total_watch_time_minutes: minutes,
              videos_watched: 1,
            });
          }

          // Insert watched video
          return supabase.from("watched_videos").insert({
            user_id: user.id,
            video_id: video.video_id,
            channel_id: video.channel_id,
          });
        });

        await Promise.all(trackVideoPromises);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watched-videos"] });
      queryClient.invalidateQueries({ queryKey: ["cached-videos"] });
      queryClient.invalidateQueries({ queryKey: ["skill-categories"] });
      queryClient.invalidateQueries({ queryKey: ["daily-activity"] });
    },
  });

  // Toggle watched mutation
  const toggleWatchedMutation = useMutation({
    mutationFn: async ({ 
      videoId, 
      channelId,
      isCurrentlyWatched 
    }: { 
      videoId: string; 
      channelId: string;
      isCurrentlyWatched: boolean;
    }) => {
      if (!user?.id) throw new Error("Not authenticated");

      if (isCurrentlyWatched) {
        const { error } = await supabase
          .from("watched_videos")
          .delete()
          .eq("user_id", user.id)
          .eq("video_id", videoId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("watched_videos")
          .upsert({
            user_id: user.id,
            video_id: videoId,
            channel_id: channelId,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watched-videos"] });
      queryClient.invalidateQueries({ queryKey: ["cached-videos"] });
    },
  });

  const isWatched = (videoId: string) => {
    return watchedVideos.some(w => w.video_id === videoId);
  };

  const markAsWatched = (videoId: string, channelId: string, olderVideoIds?: string[], durationMinutes?: number) => {
    markAsWatchedMutation.mutate({ videoId, channelId, olderVideoIds, durationMinutes: durationMinutes || 0 });
  };

  const toggleWatched = (videoId: string, channelId: string) => {
    const isCurrentlyWatched = isWatched(videoId);
    toggleWatchedMutation.mutate({ videoId, channelId, isCurrentlyWatched });
  };

  return { 
    markAsWatched, 
    isWatched, 
    toggleWatched,
    watchedVideos 
  };
};
