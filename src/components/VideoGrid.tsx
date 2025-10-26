import { useState, useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Play, CheckCircle2, ArrowUpDown } from "lucide-react";
import { VideoPlayer } from "./VideoPlayer";
import { useWatchedVideos } from "@/hooks/useWatchedVideos";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const { markAsWatched, isWatched, toggleWatched } = useWatchedVideos();

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<{ videos: Video[]; nextPageToken?: string | null }, Error>({
    initialPageParam: null,
    queryKey: ["videos", channelId, sortOrder],
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.functions.invoke("youtube-videos", {
        body: { 
          channelId, 
          pageToken: pageParam ?? null,
          order: sortOrder === "newest" ? "date" : "date"
        },
      });

      if (error) throw error;
      return data as { videos: Video[]; nextPageToken?: string | null };
    },
    getNextPageParam: (lastPage) => lastPage?.nextPageToken || undefined,
    enabled: !!channelId,
  });

  // Auto-load all pages when switching to "oldest" sort order
  useEffect(() => {
    if (sortOrder === "oldest" && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [sortOrder, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const allVideos = data ? data.pages.flatMap((p) => p.videos as Video[]) : [];

  // Sort videos based on user preference
  const sortedVideos = allVideos.length
    ? [...allVideos].sort((a, b) => {
        const dateA = new Date(a.snippet.publishedAt).getTime();
        const dateB = new Date(b.snippet.publishedAt).getTime();
        return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
      })
    : [];

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

  if (!sortedVideos || sortedVideos.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Keine langen Videos gefunden</p>
        <p className="text-sm mt-2">Dieser Kanal hat keine Videos über 60 Sekunden</p>
      </div>
    );
  }

  const formatViews = (views: string) => {
    const num = parseInt(views);
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return "Gestern";
    if (diffDays < 7) return `vor ${diffDays} Tagen`;
    if (diffDays < 30) return `vor ${Math.floor(diffDays / 7)} Wochen`;
    if (diffDays < 365) return `vor ${Math.floor(diffDays / 30)} Monaten`;
    return `vor ${Math.floor(diffDays / 365)} Jahren`;
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{channelName}</h2>
          <p className="text-muted-foreground">
            {sortedVideos.length} {sortedVideos.length === 1 ? "Video" : "Videos"}
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
        {sortedVideos.map((video) => {
          const watched = isWatched(video.id);
          return (
            <div key={video.id} className="group space-y-3">
              <div
                onClick={() => setSelectedVideo({ id: video.id, title: video.snippet.title })}
                className="relative aspect-video rounded-lg overflow-hidden bg-card cursor-pointer"
              >
                <img
                  src={video.snippet.thumbnails.medium.url}
                  alt={video.snippet.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  <Play className="text-white opacity-0 group-hover:opacity-100 transition-opacity h-12 w-12" />
                </div>
                {watched && (
                  <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                    <CheckCircle2 className="h-5 w-5 text-white" />
                  </div>
                )}
              </div>
              <div>
                <h3 className="font-medium line-clamp-2 group-hover:text-primary transition-colors">
                  {video.snippet.title}
                </h3>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-sm text-muted-foreground">
                    {formatViews(video.statistics.viewCount)} Aufrufe •{" "}
                    {formatDate(video.snippet.publishedAt)}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleWatched(video.id);
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <CheckCircle2
                      className={`h-5 w-5 ${
                        watched ? "fill-green-500 text-green-500" : ""
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {hasNextPage && (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? "Lädt..." : "Mehr laden"}
          </Button>
        </div>
      )}
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
