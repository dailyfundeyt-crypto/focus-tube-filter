import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink } from "lucide-react";

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
  const { data, isLoading, error } = useQuery({
    queryKey: ["videos", channelId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("youtube-videos", {
        body: { channelId },
      });

      if (error) throw error;
      return data.videos as Video[];
    },
    enabled: !!channelId,
  });

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

  if (!data || data.length === 0) {
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
      <div className="mb-6">
        <h2 className="text-2xl font-bold">{channelName}</h2>
        <p className="text-muted-foreground">
          {data.length} {data.length === 1 ? "Video" : "Videos"}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.map((video) => (
          <a
            key={video.id}
            href={`https://www.youtube.com/watch?v=${video.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group space-y-3 transition-transform hover:scale-[1.02]"
          >
            <div className="relative aspect-video rounded-lg overflow-hidden bg-card">
              <img
                src={video.snippet.thumbnails.medium.url}
                alt={video.snippet.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                <ExternalLink className="text-white opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8" />
              </div>
            </div>
            <div>
              <h3 className="font-medium line-clamp-2 group-hover:text-primary transition-colors">
                {video.snippet.title}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {formatViews(video.statistics.viewCount)} Aufrufe •{" "}
                {formatDate(video.snippet.publishedAt)}
              </p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
};
