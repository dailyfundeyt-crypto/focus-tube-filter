import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export const AddChannelDialog = () => {
  const [open, setOpen] = useState(false);
  const [channelInput, setChannelInput] = useState("");
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const addChannelMutation = useMutation({
    mutationFn: async (input: string) => {
      if (!user) throw new Error("Nicht angemeldet");

      // First, get channel info from YouTube API
      const { data: channelData, error: functionError } = await supabase.functions.invoke(
        "youtube-channel-info",
        {
          body: { channelInput: input },
        }
      );

      if (functionError) throw functionError;
      if (!channelData) throw new Error("Kanal nicht gefunden");

      // Categorize the channel using AI
      const { data: categoryData, error: categoryError } = await supabase.functions.invoke(
        'categorize-channel',
        {
          body: { channelName: channelData.channelName }
        }
      );

      const category = categoryError ? 'Sonstiges' : categoryData?.category || 'Sonstiges';

      // Then save to database
      const { error: dbError } = await supabase.from("youtube_channels").insert({
        user_id: user.id,
        channel_id: channelData.channelId,
        channel_name: channelData.channelName,
        channel_thumbnail: channelData.channelThumbnail,
        category: category,
      });

      if (dbError) {
        if (dbError.code === "23505") {
          throw new Error("Dieser Kanal wurde bereits hinzugefügt");
        }
        throw dbError;
      }

      // Auto-fetch all videos for this channel
      console.log("Auto-fetching videos for new channel:", channelData.channelId);
      let allVideos = [];
      let pageToken = null;
      let pageCount = 0;
      
      do {
        pageCount++;
        const { data, error } = await supabase.functions.invoke("youtube-videos", {
          body: { 
            channelId: channelData.channelId,
            pageToken,
            order: "date"
          },
        });

        if (error) {
          console.error("Error fetching videos:", error);
          break;
        }

        const videos = data.videos || [];
        allVideos.push(...videos);
        pageToken = data.nextPageToken;
        
        console.log(`Page ${pageCount}: ${videos.length} videos, total: ${allVideos.length}`);
      } while (pageToken && pageCount < 20);
      
      // Helper to parse ISO 8601 duration to seconds
      const parseDuration = (duration: string): number => {
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match) return 0;
        const hours = parseInt(match[1] || '0');
        const minutes = parseInt(match[2] || '0');
        const seconds = parseInt(match[3] || '0');
        return hours * 3600 + minutes * 60 + seconds;
      };

      // Cache all videos with duration
      for (const video of allVideos) {
        await supabase.from("cached_videos").insert({
          user_id: user.id,
          channel_id: channelData.channelId,
          video_id: video.id,
          title: video.snippet.title,
          thumbnail: video.snippet.thumbnails.medium.url,
          published_at: video.snippet.publishedAt,
          video_url: `https://www.youtube.com/watch?v=${video.id}`,
          duration_seconds: parseDuration(video.contentDetails?.duration || "PT0S"),
        });
      }

      console.log(`Cached ${allVideos.length} videos for channel ${channelData.channelName}`);

      return { ...channelData, videoCount: allVideos.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      queryClient.invalidateQueries({ queryKey: ["cached-videos"] });
      toast.success(`Kanal hinzugefügt! ${data.videoCount} Videos geladen`);
      setChannelInput("");
      setOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Fehler beim Hinzufügen des Kanals");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (channelInput.trim()) {
      addChannelMutation.mutate(channelInput.trim());
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full gap-2">
          <Plus className="h-4 w-4" />
          Kanal hinzufügen
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>YouTube-Kanal hinzufügen</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              placeholder="Kanal-URL, ID oder @username"
              value={channelInput}
              onChange={(e) => setChannelInput(e.target.value)}
              disabled={addChannelMutation.isPending}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Beispiele: youtube.com/@username, UCxxxxx, @username
            </p>
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={!channelInput.trim() || addChannelMutation.isPending}
          >
            {addChannelMutation.isPending ? "Wird hinzugefügt..." : "Hinzufügen"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
