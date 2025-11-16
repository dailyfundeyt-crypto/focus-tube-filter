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
      olderVideoIds 
    }: { 
      videoId: string; 
      channelId: string;
      olderVideoIds?: string[];
    }) => {
      if (!user?.id) throw new Error("Not authenticated");

      // Mark the selected video and all older videos
      const videosToMark = [videoId, ...(olderVideoIds || [])];
      
      const { error } = await supabase
        .from("watched_videos")
        .upsert(
          videosToMark.map(vid => ({
            user_id: user.id,
            video_id: vid,
            channel_id: channelId,
          })),
          { onConflict: "user_id,video_id" }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watched-videos"] });
      queryClient.invalidateQueries({ queryKey: ["cached-videos"] });
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

  const markAsWatched = (videoId: string, channelId: string, olderVideoIds?: string[]) => {
    markAsWatchedMutation.mutate({ videoId, channelId, olderVideoIds });
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
