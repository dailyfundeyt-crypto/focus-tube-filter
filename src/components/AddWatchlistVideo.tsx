import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

type VideoSource = "youtube" | "x";

interface ParsedVideo {
  source: VideoSource;
  videoId: string;
  videoUrl: string;
}

function parseVideoInput(input: string): ParsedVideo | null {
  const trimmed = input.trim();

  // X/Twitter: https://x.com/user/status/123 or https://twitter.com/user/status/123
  const xMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com)\/([^/]+)\/status\/(\d+)/);
  if (xMatch) {
    return {
      source: "x",
      videoId: `x-${xMatch[2]}`,
      videoUrl: `https://x.com/${xMatch[1]}/status/${xMatch[2]}`,
    };
  }

  // youtube.com/watch?v=ID
  const watchMatch = trimmed.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (watchMatch) return { source: "youtube", videoId: watchMatch[1], videoUrl: `https://www.youtube.com/watch?v=${watchMatch[1]}` };
  // youtu.be/ID
  const shortMatch = trimmed.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (shortMatch) return { source: "youtube", videoId: shortMatch[1], videoUrl: `https://www.youtube.com/watch?v=${shortMatch[1]}` };
  // youtube.com/embed/ID
  const embedMatch = trimmed.match(/embed\/([A-Za-z0-9_-]{11})/);
  if (embedMatch) return { source: "youtube", videoId: embedMatch[1], videoUrl: `https://www.youtube.com/watch?v=${embedMatch[1]}` };
  // Raw video ID
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return { source: "youtube", videoId: trimmed, videoUrl: `https://www.youtube.com/watch?v=${trimmed}` };

  return null;
}

export const AddWatchlistVideo = () => {
  const [open, setOpen] = useState(false);
  const [videoInput, setVideoInput] = useState("");
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const addVideoMutation = useMutation({
    mutationFn: async (input: string) => {
      if (!user) throw new Error("Nicht angemeldet");

      const parsed = parseVideoInput(input);
      if (!parsed) throw new Error("Ungültiger YouTube- oder X-Link");

      let title = `Video ${parsed.videoId}`;
      let thumbnail: string | null = null;

      if (parsed.source === "youtube") {
        thumbnail = `https://img.youtube.com/vi/${parsed.videoId}/mqdefault.jpg`;
        try {
          const oembedResp = await fetch(
            `https://www.youtube.com/oembed?url=${parsed.videoUrl}&format=json`
          );
          if (oembedResp.ok) {
            const oembedData = await oembedResp.json();
            title = oembedData.title || title;
            thumbnail = oembedData.thumbnail_url || thumbnail;
          }
        } catch {
          // Fall back to defaults
        }
      } else if (parsed.source === "x") {
        title = `X Post ${parsed.videoId.replace("x-", "")}`;
        // Try to get title from publish.twitter.com oEmbed
        try {
          const oembedResp = await fetch(
            `https://publish.twitter.com/oembed?url=${encodeURIComponent(parsed.videoUrl)}`
          );
          if (oembedResp.ok) {
            const oembedData = await oembedResp.json();
            // Extract text from HTML author_name
            title = oembedData.author_name
              ? `${oembedData.author_name}: Post`
              : title;
          }
        } catch {
          // Fall back to defaults
        }
      }

      const { error } = await supabase.from("watchlist_videos").insert({
        user_id: user.id,
        video_id: parsed.videoId,
        title,
        thumbnail,
        video_url: parsed.videoUrl,
      });

      if (error) {
        if (error.code === "23505") throw new Error("Video bereits in der Watchlist");
        throw error;
      }

      return { title };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["watchlist-videos"] });
      toast.success(`"${data.title}" zur Watchlist hinzugefügt`);
      setVideoInput("");
      setOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Fehler beim Hinzufügen");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full gap-2">
          <Plus className="h-4 w-4" />
          Video hinzufügen
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Video zur Watchlist hinzufügen</DialogTitle>
          <DialogDescription>
            Füge einen YouTube- oder X/Twitter-Link hinzu, den du später ansehen möchtest
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="videoUrl">Video-Link</Label>
            <Input
              id="videoUrl"
              placeholder="YouTube- oder X-Link einfügen..."
              value={videoInput}
              onChange={(e) => setVideoInput(e.target.value)}
              disabled={addVideoMutation.isPending}
            />
          </div>
          <Button
            onClick={() => addVideoMutation.mutate(videoInput)}
            disabled={addVideoMutation.isPending || !videoInput.trim()}
            className="w-full"
          >
            {addVideoMutation.isPending ? "Wird hinzugefügt..." : "Hinzufügen"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
