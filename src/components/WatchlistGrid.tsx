import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { VideoPlayer } from "./VideoPlayer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Play } from "lucide-react";
import { AddWatchlistVideo } from "./AddWatchlistVideo";
import { toast } from "sonner";

export const WatchlistGrid = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedVideo, setSelectedVideo] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const { data: videos, isLoading } = useQuery({
    queryKey: ["watchlist-videos", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("watchlist_videos")
        .select("*")
        .eq("user_id", user.id)
        .order("added_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("watchlist_videos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist-videos"] });
      toast.success("Video entfernt");
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-3">
            <div className="aspect-video bg-card rounded-lg animate-pulse" />
            <div className="h-4 bg-card rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">📌 Später ansehen</h2>
          <p className="text-muted-foreground">
            {videos?.length || 0} {(videos?.length || 0) === 1 ? "Video" : "Videos"} in deiner Watchlist
          </p>
        </div>
        <AddWatchlistVideo />
      </div>

      {!videos || videos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>Noch keine Videos in der Watchlist</p>
          <p className="text-sm mt-2">Füge YouTube-Links hinzu, die du später ansehen möchtest</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {videos.map((video) => (
            <Card
              key={video.id}
              className="group overflow-hidden cursor-pointer transition-all hover:shadow-lg border-border"
              onClick={() => setSelectedVideo({ id: video.video_id, title: video.title })}
            >
              <div className="relative">
                <img
                  src={video.thumbnail || `https://img.youtube.com/vi/${video.video_id}/mqdefault.jpg`}
                  alt={video.title}
                  className="w-full aspect-video object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <Play className="h-12 w-12 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              <div className="p-4 space-y-3">
                <h3 className="font-medium line-clamp-2 text-foreground">{video.title}</h3>
                <p className="text-xs text-muted-foreground">
                  Hinzugefügt: {new Date(video.added_at).toLocaleDateString("de-DE")}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteMutation.mutate(video.id);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Entfernen
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <VideoPlayer
        videoId={selectedVideo?.id || null}
        videoTitle={selectedVideo?.title || ""}
        channelId="watchlist"
        channelName="Später ansehen"
        durationMinutes={0}
        onClose={() => setSelectedVideo(null)}
        onVideoEnd={() => setSelectedVideo(null)}
        onMarkAsWatched={() => {}}
      />
    </div>
  );
};
