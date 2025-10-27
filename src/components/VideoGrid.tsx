import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowUpDown } from "lucide-react";
import { VideoPlayer } from "./VideoPlayer";
import { useWatchedVideos } from "@/hooks/useWatchedVideos";
import { VideoCard } from "./VideoCard";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";

interface Video {
  id: string;
  snippet: {
    title: string;
    thumbnails: {
      medium: {
        url: string;
      };
    };
    publishedAt: string;
  };
  statistics: {
    viewCount: string;
  };
}

interface VideoGridProps {
  channelId: string;
  channelName: string;
}

export const VideoGrid = ({ channelId, channelName }: VideoGridProps) => {
  const [selectedVideo, setSelectedVideo] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const { markAsWatched } = useWatchedVideos();
  const { user } = useAuth();

  const { data: cachedVideos, isLoading, error, refetch } = useQuery({
    queryKey: ["cached-videos", channelId, user?.id, sortOrder],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("cached_videos")
        .select("*")
        .eq("user_id", user.id)
        .eq("channel_id", channelId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!channelId && !!user,
  });

  // Auto-fetch videos on first load if cache is empty
  useEffect(() => {
    const loadInitialVideos = async () => {
      if (!user || !channelId || !cachedVideos) return;
      if (cachedVideos.length > 0) return; // Already have cached videos

      try {
        const { data, error } = await supabase.functions.invoke("youtube-videos", {
          body: { 
            channelId,
            pageToken: null,
            order: "date"
          },
        });

        if (error) throw error;

        const videos = data.videos || [];
        
        for (const video of videos) {
          await supabase.from("cached_videos").upsert({
            user_id: user.id,
            channel_id: channelId,
            video_id: video.id,
            title: video.snippet.title,
            thumbnail: video.snippet.thumbnails.medium.url,
            published_at: video.snippet.publishedAt,
            video_url: `https://www.youtube.com/watch?v=${video.id}`,
          }, {
            onConflict: 'user_id,video_id'
          });
        }
        
        refetch();
      } catch (err) {
        console.error("Error loading initial videos:", err);
      }
    };

    loadInitialVideos();
  }, [channelId, user, cachedVideos, refetch]);

  const sortedVideos = cachedVideos
    ? [...cachedVideos].sort((a, b) => {
        const dateA = new Date(a.published_at || "").getTime();
        const dateB = new Date(b.published_at || "").getTime();
        return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
      })
    : [];

  const videosAsApiFormat = sortedVideos.map(v => ({
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
        <p>Keine Videos gecacht</p>
        <p className="text-sm mt-2">Klicke auf "Updaten" um Videos zu laden</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{channelName}</h2>
          <p className="text-muted-foreground">
            {videosAsApiFormat.length} {videosAsApiFormat.length === 1 ? "Video" : "Videos"}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowUpDown className="h-4 w-4" />
              {sortOrder === "newest" ? "Neueste zuerst" : "Älteste zuerst"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setSortOrder("newest")}>
              Neueste zuerst
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortOrder("oldest")}>
              Älteste zuerst
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {videosAsApiFormat.map((video) => (
          <VideoCard
            key={video.id}
            video={video}
            onVideoClick={(id, title) => setSelectedVideo({ id, title })}
          />
        ))}
      </div>
      <VideoPlayer
        videoId={selectedVideo?.id || null}
        videoTitle={selectedVideo?.title || ""}
        onClose={() => setSelectedVideo(null)}
        onVideoEnd={() => {
          if (selectedVideo) {
            markAsWatched(selectedVideo.id);
          }
        }}
      />
    </div>
  );
};
