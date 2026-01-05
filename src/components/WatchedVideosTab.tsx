import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { VideoCard } from "./VideoCard";
import { VideoPlayer } from "./VideoPlayer";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface WatchedVideosTabProps {
  channelId: string;
  channelName: string;
}

export const WatchedVideosTab = ({ channelId, channelName }: WatchedVideosTabProps) => {
  const { user } = useAuth();
  const [selectedVideo, setSelectedVideo] = useState<{ id: string; title: string } | null>(null);

  const { data: watchedVideos, isLoading } = useQuery({
    queryKey: ["watched-videos-list", channelId, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Fetch all watched video IDs with pagination to bypass 1000 row limit
      let allWatchedIds: string[] = [];
      let page = 0;
      const pageSize = 1000;
      
      while (true) {
        const { data: watched, error: watchedError } = await supabase
          .from("watched_videos")
          .select("video_id")
          .eq("user_id", user.id)
          .eq("channel_id", channelId)
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (watchedError) throw watchedError;
        
        if (!watched || watched.length === 0) break;
        
        allWatchedIds.push(...watched.map(w => w.video_id));
        
        if (watched.length < pageSize) break;
        page++;
      }
      
      if (allWatchedIds.length === 0) return [];

      // Fetch all videos with pagination to bypass 1000 row limit
      let allVideos: any[] = [];
      page = 0;
      
      while (true) {
        const { data: videos, error: videosError } = await supabase
          .from("cached_videos")
          .select("*")
          .eq("user_id", user.id)
          .eq("channel_id", channelId)
          .in("video_id", allWatchedIds)
          .order("published_at", { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (videosError) throw videosError;
        
        if (!videos || videos.length === 0) break;
        
        allVideos.push(...videos);
        
        if (videos.length < pageSize) break;
        page++;
      }

      return allVideos.map(video => ({
        id: video.video_id,
        durationMinutes: Math.ceil((video.duration_seconds || 0) / 60),
        snippet: {
          title: video.title,
          thumbnails: {
            medium: { url: video.thumbnail || "" }
          },
          publishedAt: video.published_at || "",
        }
      }));
    },
    enabled: !!channelId && !!user,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Gesehene Videos - {channelName}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  if (!watchedVideos || watchedVideos.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Noch keine gesehenen Videos</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Gesehene Videos - {channelName}</h2>
      <p className="text-sm text-muted-foreground">{watchedVideos.length} Videos gesehen</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {watchedVideos.map((video) => (
          <VideoCard
            key={video.id}
            video={video}
            channelId={channelId}
            onVideoClick={(id, title) => setSelectedVideo({ id, title })}
          />
        ))}
      </div>

      <VideoPlayer
        videoId={selectedVideo?.id || null}
        videoTitle={selectedVideo?.title || ""}
        channelId={channelId}
        channelName={channelName}
        durationMinutes={
          watchedVideos.find(v => v.id === selectedVideo?.id)?.durationMinutes || 0
        }
        onClose={() => setSelectedVideo(null)}
        onVideoEnd={() => setSelectedVideo(null)}
      />
    </div>
  );
};
