import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";

// Helper function to parse ISO 8601 duration to seconds
const parseDuration = (duration: string): number => {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');
  
  return hours * 3600 + minutes * 60 + seconds;
};

export const useCacheVideos = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      videos,
      channelId,
      userId,
    }: {
      videos: any[];
      channelId: string;
      userId: string;
    }) => {
      const videosToCache = videos.map((video) => ({
        user_id: userId,
        video_id: video.id,
        channel_id: channelId,
        title: video.snippet.title,
        thumbnail: video.snippet.thumbnails?.medium?.url || "",
        video_url: `https://www.youtube.com/watch?v=${video.id}`,
        published_at: video.snippet.publishedAt,
        duration_seconds: parseDuration(video.contentDetails?.duration || "PT0S"),
      }));

      const { error } = await supabase
        .from("cached_videos")
        .upsert(videosToCache, {
          onConflict: "user_id,video_id",
          ignoreDuplicates: false,
        });

      if (error) throw error;

      return videosToCache.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["cached-videos"] });
      toast({
        title: "Videos gecacht!",
        description: `${count} Videos wurden gespeichert`,
      });
    },
    onError: (error) => {
      console.error("Error caching videos:", error);
      toast({
        title: "Fehler",
        description: "Videos konnten nicht gecacht werden",
        variant: "destructive",
      });
    },
  });
};
