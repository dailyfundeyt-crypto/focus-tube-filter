import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Link } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

function extractVideoId(input: string): string | null {
  // youtube.com/watch?v=ID
  const watchMatch = input.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];
  // youtu.be/ID
  const shortMatch = input.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];
  // youtube.com/embed/ID
  const embedMatch = input.match(/embed\/([A-Za-z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];
  // Raw video ID
  if (/^[A-Za-z0-9_-]{11}$/.test(input.trim())) return input.trim();
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

      const videoId = extractVideoId(input);
      if (!videoId) throw new Error("Ungültiger YouTube-Link");

      // Fetch video info from YouTube oEmbed (no API key needed)
      let title = `Video ${videoId}`;
      let thumbnail = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

      try {
        const oembedResp = await fetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
        );
        if (oembedResp.ok) {
          const oembedData = await oembedResp.json();
          title = oembedData.title || title;
          thumbnail = oembedData.thumbnail_url || thumbnail;
        }
      } catch {
        // Fall back to defaults
      }

      const { error } = await supabase.from("watchlist_videos").insert({
        user_id: user.id,
        video_id: videoId,
        title,
        thumbnail,
        video_url: `https://www.youtube.com/watch?v=${videoId}`,
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
            Füge einen YouTube-Link hinzu, den du später ansehen möchtest
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="videoUrl">YouTube-Link</Label>
            <Input
              id="videoUrl"
              placeholder="https://www.youtube.com/watch?v=..."
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
