import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EmbeddedVideoPlayer } from "./EmbeddedVideoPlayer";
import { useWatchedVideos } from "@/hooks/useWatchedVideos";
import { VideoCard } from "./VideoCard";
import { useAuth } from "@/contexts/AuthContext";

interface VideoGridProps {
  channelId: string;
  channelName: string;
}

export const VideoGrid = ({ channelId, channelName }: VideoGridProps) => {
  const [selectedVideo, setSelectedVideo] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const { markAsWatched, watchedVideos } = useWatchedVideos(channelId);
  const { user } = useAuth();

  const { data: cachedVideos, isLoading, error } = useQuery({
    queryKey: ["cached-videos", channelId, user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("cached_videos")
        .select("*")
        .eq("user_id", user.id)
        .eq("channel_id", channelId)
        .order("published_at", { ascending: true }); // Always oldest first

      if (error) throw error;
      return data || [];
    },
    enabled: !!channelId && !!user,
  });

  // Get watched video IDs
  const watchedVideoIds = new Set(watchedVideos?.map(w => w.video_id) || []);

  // Filter out watched videos
  const unwatchedVideos = cachedVideos?.filter(v => !watchedVideoIds.has(v.video_id)) || [];

  const videosAsApiFormat = unwatchedVideos.map(v => ({
    id: v.video_id,
    snippet: {
      title: v.title,
      thumbnails: {
        medium: { url: v.thumbnail || "" }
      },
      publishedAt: v.published_at || ""
    }
  }));

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="space-y-3">
            <div className="aspect-video bg-card rounded-lg animate-pulse" />
            <div className="h-4 bg-card rounded animate-pulse" />
            <div className="h-3 bg-card rounded animate-pulse w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-destructive">
        <p>Fehler beim Laden der Videos</p>
        <p className="text-sm mt-2">Bitte versuche es später erneut</p>
      </div>
    );
  }

  if (!videosAsApiFormat || videosAsApiFormat.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Alle Videos gesehen! 🎉</p>
        <p className="text-sm mt-2">Klicke auf "Updaten" um neue Videos zu laden</p>
      </div>
    );
  }

  const handleVideoClick = (videoId: string, title: string) => {
    setSelectedVideo({ id: videoId, title });
    
    // Find all videos older than the selected one
    const selectedIndex = unwatchedVideos.findIndex(v => v.video_id === videoId);
    const olderVideoIds = unwatchedVideos
      .slice(0, selectedIndex)
      .map(v => v.video_id);
    
    // Mark selected video and all older videos as watched
    markAsWatched(videoId, channelId, olderVideoIds);
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">{channelName}</h2>
        <p className="text-muted-foreground">
          {videosAsApiFormat.length} ungesehene {videosAsApiFormat.length === 1 ? "Video" : "Videos"}
        </p>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {videosAsApiFormat.map((video) => (
          <VideoCard
            key={video.id}
            video={video}
            channelId={channelId}
            onVideoClick={handleVideoClick}
          />
        ))}
      </div>
      
      <EmbeddedVideoPlayer
        videoId={selectedVideo?.id || null}
        videoTitle={selectedVideo?.title || ""}
        onClose={() => setSelectedVideo(null)}
      />
    </div>
  );
};
