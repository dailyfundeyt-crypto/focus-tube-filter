import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Copy, Check } from "lucide-react";
import { useWatchedVideos } from "@/hooks/useWatchedVideos";
import { useToast } from "@/hooks/use-toast";

interface VideoCardProps {
  video: {
    id: string;
    snippet: {
      title: string;
      thumbnails: {
        medium: { url: string };
      };
      publishedAt: string;
    };
  };
  onVideoClick: (videoId: string, title: string) => void;
}

export const VideoCard = ({ video, onVideoClick }: VideoCardProps) => {
  const { isWatched, toggleWatched } = useWatchedVideos();
  const watched = isWatched(video.id);
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const videoUrl = `https://www.youtube.com/watch?v=${video.id}`;

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(videoUrl);
      setCopied(true);
      toast({ title: "Link kopiert!" });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({ 
        title: "Fehler", 
        description: "Link konnte nicht kopiert werden",
        variant: "destructive" 
      });
    }
  };

  const handleToggleWatched = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleWatched(video.id);
  };

  return (
    <Card 
      className="group overflow-hidden cursor-pointer transition-all hover:shadow-lg border-border"
      onClick={() => onVideoClick(video.id, video.snippet.title)}
    >
      <div className="relative">
        <img
          src={video.snippet.thumbnails.medium.url}
          alt={video.snippet.title}
          className="w-full aspect-video object-cover"
        />
        {watched && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Badge variant="secondary" className="text-sm">Gesehen</Badge>
          </div>
        )}
      </div>
      <div className="p-4 space-y-3">
        <h3 className="font-medium line-clamp-2 text-foreground">
          {video.snippet.title}
        </h3>
        <p className="text-xs text-muted-foreground">
          {new Date(video.snippet.publishedAt).toLocaleDateString("de-DE")}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleWatched}
            className="flex-1"
          >
            {watched ? (
              <>
                <EyeOff className="w-4 h-4 mr-1" />
                Ungesehen
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 mr-1" />
                Gesehen
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="flex-1"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-1" />
                Kopiert
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-1" />
                Link
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
};
