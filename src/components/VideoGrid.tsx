import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VideoPlayer } from "./VideoPlayer";
import { useWatchedVideos } from "@/hooks/useWatchedVideos";
import { VideoCard } from "./VideoCard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Copy, GraduationCap } from "lucide-react";

const COACH_PROMPT = `Deine Aufgabe ist es, das gegebene YouTube-Video vom Nutzer zu analysieren und ihm die wichtigsten Informationen daraus zu erklären. Strukturiere die Informationen als Überschriften mit jeweils einer kurzen Beschreibung der Technik/des Konzepts, die im Video besprochen wird.

Der Nutzer wird sich das Video NICHT ansehen – er hat keine Zeit und versucht durch dich seine Produktivität zu steigern. Erkläre die Themen so gut, dass er sie versteht, als hätte er das Video selbst gesehen.

Deine Rolle: Senior Trader. Du bist ein erfahrener Trader und stehst für die 3 Werte des Tradings ein:
1. Denke konditionell
2. Handle emotionslos
3. Handle datenbasiert

Du unterrichtest deinen Schüler so gut wie möglich. Wichtig: Nach jeder Session prüfst du, ob die neuen Informationen mit bereits gelernten Inhalten aus dem Google-Drive-Obsidian-Ordner des Schülers verbunden werden können.

Nach dem Gespräch:
1. Schreibe die gelernten Dinge zusammen, damit der Schüler sie in seinen Obsidian-Vault speichern kann.
2. Erstelle Karteikarten mit den wichtigsten neu gelernten Informationen im folgenden Format in einem Code-Block (eine Karte pro Zeile, Trennung durch Semikolon):

\`\`\`
Vorderseite;Rückseite
Vorderseite;Rückseite
\`\`\`

Los geht's – hier ist mein Video:`;

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
    
    // Only open the video player - don't mark as watched automatically
    setSelectedVideo({ id: videoId, title });
  };

  const handleMarkAsWatched = (videoId: string) => {
    // Mark only this specific video as watched (not older videos)
    const selectedVideoData = unwatchedVideos.find(v => v.video_id === videoId);
    const durationMinutes = Math.ceil((selectedVideoData?.duration_seconds || 0) / 60);
    
    // Mark only this video as watched - no older videos
    markAsWatched(videoId, channelId, [], durationMinutes);
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

    // Mark only the selected videos as watched (not all older videos)
    selectedVideos.forEach(videoId => {
      const videoData = unwatchedVideos.find(v => v.video_id === videoId);
      const durationMinutes = Math.ceil((videoData?.duration_seconds || 0) / 60);
      markAsWatched(videoId, channelId, [], durationMinutes);
    });

    setMultiSelectMode(false);
    setSelectedVideos(new Set());
  };

  const handleCopyNextTenAndMarkWatched = async () => {
    const nextTen = unwatchedVideos.slice(0, 10);
    if (nextTen.length === 0) return;

    const links = nextTen
      .map((v) => `https://www.youtube.com/watch?v=${v.video_id}`)
      .join("\n");

    try {
      await navigator.clipboard.writeText(links);
    } catch {
      toast.error("Links konnten nicht kopiert werden");
      return;
    }

    nextTen.forEach((v) => {
      const durationMinutes = Math.ceil((v.duration_seconds || 0) / 60);
      markAsWatched(v.video_id, channelId, [], durationMinutes);
    });

    toast.success(`${nextTen.length} Links kopiert & als gesehen markiert`);
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{channelName}</h2>
          <p className="text-muted-foreground">
            {videosAsApiFormat.length} ungesehene {videosAsApiFormat.length === 1 ? "Video" : "Videos"}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyNextTenAndMarkWatched}
            disabled={unwatchedVideos.length === 0}
          >
            <Copy className="h-4 w-4 mr-1" />
            10 Links kopieren
          </Button>
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
        durationMinutes={
          Math.ceil((unwatchedVideos.find(v => v.video_id === selectedVideo?.id)?.duration_seconds || 0) / 60)
        }
        onClose={() => setSelectedVideo(null)}
        onVideoEnd={() => setSelectedVideo(null)}
        onMarkAsWatched={(videoId, durationMinutes) => {
          markAsWatched(videoId, channelId, [], durationMinutes);
        }}
      />
    </div>
  );
};
