import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Copy, Check, Bookmark } from "lucide-react";
import { useWatchedVideos } from "@/hooks/useWatchedVideos";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  channelId: string;
  onVideoClick: (videoId: string, title: string) => void;
  onMarkAsWatched?: (videoId: string) => void;
  multiSelectMode?: boolean;
  isSelected?: boolean;
  onSelect?: (videoId: string, selected: boolean) => void;
}

export const VideoCard = ({ 
  video, 
  channelId, 
  onVideoClick, 
  onMarkAsWatched,
  multiSelectMode = false,
  isSelected = false,
  onSelect 
}: VideoCardProps) => {
  const { isWatched, toggleWatched } = useWatchedVideos(channelId);
  const watched = isWatched(video.id);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const videoUrl = `https://www.youtube.com/watch?v=${video.id}`;

  // Fetch categories for save-to-folder
  const { data: categories = [] } = useQuery({
    queryKey: ["skill-categories", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("skill_categories")
        .select("*")
        .eq("user_id", user.id)
        .order("category_name");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const saveToFolderMutation = useMutation({
    mutationFn: async (category: string | null) => {
      if (!user) throw new Error("Nicht angemeldet");

      // Fetch title/thumbnail via oEmbed
      let title = video.snippet.title;
      let thumbnail = video.snippet.thumbnails.medium.url;

      const { error } = await supabase.from("watchlist_videos").insert({
        user_id: user.id,
        video_id: video.id,
        title,
        thumbnail,
        video_url: videoUrl,
        category,
      });

      if (error) {
        if (error.code === "23505") throw new Error("Video bereits gespeichert");
        throw error;
      }
      return { title, category };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["watchlist-videos"] });
      toast({
        title: `"${data.title}" gespeichert`,
        description: data.category ? `In Ordner: ${data.category}` : "In Später ansehen",
      });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

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
    if (onMarkAsWatched) {
      onMarkAsWatched(video.id);
    } else {
      toggleWatched(video.id, channelId);
    }
  };

  const handleCardClick = () => {
    if (multiSelectMode && onSelect) {
      onSelect(video.id, !isSelected);
    } else {
      onVideoClick(video.id, video.snippet.title);
    }
  };

  return (
    <Card 
      className={`group overflow-hidden cursor-pointer transition-all hover:shadow-lg border-border ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
      onClick={handleCardClick}
    >
      <div className="relative">
        {multiSelectMode && (
          <div className="absolute top-2 left-2 z-10">
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => onSelect?.(video.id, !!checked)}
              className="bg-background border-2"
            />
          </div>
        )}
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => e.stopPropagation()}
              >
                <Bookmark className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => saveToFolderMutation.mutate(null)}>
                📌 Später ansehen
              </DropdownMenuItem>
              {categories.map((cat) => (
                <DropdownMenuItem
                  key={cat.id}
                  onClick={() => saveToFolderMutation.mutate(cat.category_name)}
                >
                  📁 {cat.category_name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
};
