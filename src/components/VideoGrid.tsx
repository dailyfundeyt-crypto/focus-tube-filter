import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VideoPlayer } from "./VideoPlayer";
import { useWatchedVideos } from "@/hooks/useWatchedVideos";
import { VideoCard } from "./VideoCard";
import { Button } from "@/components/ui/button";
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
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
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
    if (multiSelectMode) return;
    
    setSelectedVideo({ id: videoId, title });
    
    // Find all videos older than the selected one
    const selectedIndex = unwatchedVideos.findIndex(v => v.video_id === videoId);
    const olderVideoIds = unwatchedVideos
      .slice(0, selectedIndex)
      .map(v => v.video_id);
    
    // Mark selected video and all older videos as watched
    markAsWatched(videoId, channelId, olderVideoIds);
  };

  const handleMarkAsWatched = (videoId: string) => {
    // Find all videos older than the selected one
    const selectedIndex = unwatchedVideos.findIndex(v => v.video_id === videoId);
    const olderVideoIds = unwatchedVideos
      .slice(0, selectedIndex)
      .map(v => v.video_id);
    
    // Mark selected video and all older videos as watched
    markAsWatched(videoId, channelId, olderVideoIds);
  };

  const handleToggleMultiSelect = () => {
    setMultiSelectMode(!multiSelectMode);
    setSelectedVideos(new Set());
  };

  const handleVideoSelect = (videoId: string, selected: boolean) => {
    setSelectedVideos(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(videoId);
      } else {
        newSet.delete(videoId);
      }
      return newSet;
    });
  };

  const handleMarkSelectedAsWatched = () => {
    if (selectedVideos.size === 0) return;

    // Find the indices of selected videos
    const selectedIndices = Array.from(selectedVideos).map(vid => 
      unwatchedVideos.findIndex(v => v.video_id === vid)
    ).filter(idx => idx !== -1);

    if (selectedIndices.length === 0) return;

    // Find the earliest (oldest) selected video
    const earliestIndex = Math.min(...selectedIndices);
    const latestIndex = Math.max(...selectedIndices);

    // Mark all videos from earliest to latest as watched
    const videosToMark = unwatchedVideos
      .slice(0, latestIndex + 1)
      .map(v => v.video_id);

    // Mark all these videos as watched
    if (videosToMark.length > 0) {
      const lastVideoId = videosToMark[videosToMark.length - 1];
      const olderVideoIds = videosToMark.slice(0, -1);
      markAsWatched(lastVideoId, channelId, olderVideoIds);
    }

    setMultiSelectMode(false);
    setSelectedVideos(new Set());
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{channelName}</h2>
          <p className="text-muted-foreground">
            {videosAsApiFormat.length} ungesehene {videosAsApiFormat.length === 1 ? "Video" : "Videos"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={multiSelectMode ? "default" : "outline"}
            size="sm"
            onClick={handleToggleMultiSelect}
          >
            {multiSelectMode ? "Abbrechen" : "Mehrere auswählen"}
          </Button>
          {multiSelectMode && selectedVideos.size > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={handleMarkSelectedAsWatched}
            >
              {selectedVideos.size} als gesehen markieren
            </Button>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {videosAsApiFormat.map((video) => (
          <VideoCard
            key={video.id}
            video={video}
            channelId={channelId}
            onVideoClick={handleVideoClick}
            onMarkAsWatched={handleMarkAsWatched}
            multiSelectMode={multiSelectMode}
            isSelected={selectedVideos.has(video.id)}
            onSelect={handleVideoSelect}
          />
        ))}
      </div>
      
      <VideoPlayer
        videoId={selectedVideo?.id || null}
        videoTitle={selectedVideo?.title || ""}
        channelId={channelId}
        channelName={channelName}
        onClose={() => setSelectedVideo(null)}
        onVideoEnd={() => {
          if (selectedVideo) {
            markAsWatched(selectedVideo.id, channelId);
          }
          setSelectedVideo(null);
        }}
      />
    </div>
  );
};
