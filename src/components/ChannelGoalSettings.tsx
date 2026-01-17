import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Settings, RefreshCw, CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ChannelGoalSettingsProps {
  channelId: string;
  channelName: string;
  currentGoal: number;
  currentFetchFromDate?: string | null;
  onGoalUpdate: (newGoal: number) => void;
}

// Helper function to parse ISO 8601 duration to seconds
const parseDuration = (duration: string): number => {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0");
  const minutes = parseInt(match[2] || "0");
  const seconds = parseInt(match[3] || "0");
  return hours * 3600 + minutes * 60 + seconds;
};

export function ChannelGoalSettings({ channelId, channelName, currentGoal, currentFetchFromDate, onGoalUpdate }: ChannelGoalSettingsProps) {
  const [goal, setGoal] = useState(currentGoal);
  const [fetchFromDate, setFetchFromDate] = useState<Date | undefined>(
    currentFetchFromDate ? new Date(currentFetchFromDate) : undefined
  );
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("youtube_channels")
        .update({ 
          daily_video_goal: goal,
          fetch_from_date: fetchFromDate ? format(fetchFromDate, "yyyy-MM-dd") : null
        })
        .eq("channel_id", channelId);

      if (error) throw error;

      onGoalUpdate(goal);
      toast.success("Einstellungen gespeichert");
      setOpen(false);
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Fehler beim Speichern");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefreshVideos = async () => {
    if (!user) return;
    
    setIsRefreshing(true);
    try {
      // Delete old cached videos for this channel
      const { error: deleteError } = await supabase
        .from("cached_videos")
        .delete()
        .eq("channel_id", channelId)
        .eq("user_id", user.id);

      if (deleteError) throw deleteError;

      // Re-fetch videos with date filter
      let allVideos: any[] = [];
      let pageToken: string | null = null;
      let pageCount = 0;
      const fetchFromDateStr = fetchFromDate ? format(fetchFromDate, "yyyy-MM-dd") : null;

      do {
        pageCount++;
        const { data, error } = await supabase.functions.invoke("youtube-videos", {
          body: { 
            channelId,
            pageToken,
            order: "date",
            publishedAfter: fetchFromDateStr
          },
        });

        if (error) {
          console.error("Error fetching videos:", error);
          break;
        }

        const videos = data.videos || [];
        allVideos.push(...videos);
        pageToken = data.nextPageToken;
        
        // If we got videos older than our date filter from the API, we can stop
        if (fetchFromDateStr && videos.length > 0) {
          const oldestVideo = videos[videos.length - 1];
          const oldestDate = oldestVideo?.snippet?.publishedAt?.split('T')[0];
          if (oldestDate && oldestDate < fetchFromDateStr) {
            // Filter out videos before the date
            allVideos = allVideos.filter((v: any) => {
              const pubDate = v?.snippet?.publishedAt?.split('T')[0];
              return pubDate && pubDate >= fetchFromDateStr;
            });
            break;
          }
        }
        
        console.log(`Page ${pageCount}: ${videos.length} videos, total: ${allVideos.length}`);
      } while (pageToken && pageCount < 20);

      // Final filter by date
      if (fetchFromDateStr) {
        allVideos = allVideos.filter((v: any) => {
          const pubDate = v?.snippet?.publishedAt?.split('T')[0];
          return pubDate && pubDate >= fetchFromDateStr;
        });
      }

      // Cache all videos
      for (const video of allVideos) {
        await supabase.from("cached_videos").insert({
          user_id: user.id,
          channel_id: channelId,
          video_id: video.id,
          title: video.snippet.title,
          thumbnail: video.snippet.thumbnails.medium.url,
          published_at: video.snippet.publishedAt,
          video_url: `https://www.youtube.com/watch?v=${video.id}`,
          duration_seconds: video.contentDetails?.duration ? parseDuration(video.contentDetails.duration) : 0,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["cached-videos", channelId] });
      toast.success(`${allVideos.length} Videos geladen`);
    } catch (error) {
      console.error("Error refreshing videos:", error);
      toast.error("Fehler beim Aktualisieren der Videos");
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <Settings className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Einstellungen für {channelName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>Mindestanzahl Videos pro Tag: {goal}</Label>
            <Slider
              value={[goal]}
              onValueChange={(value) => setGoal(value[0])}
              min={1}
              max={20}
              step={1}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label>Videos ab Datum laden</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Nur Videos laden, die nach diesem Datum veröffentlicht wurden
            </p>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !fetchFromDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {fetchFromDate ? format(fetchFromDate, "PPP", { locale: de }) : "Kein Datum gewählt"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={fetchFromDate}
                  onSelect={setFetchFromDate}
                  initialFocus
                  locale={de}
                />
              </PopoverContent>
            </Popover>
            {fetchFromDate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFetchFromDate(undefined)}
                className="text-xs"
              >
                Datum entfernen
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={isSaving} className="flex-1">
              {isSaving ? "Speichert..." : "Speichern"}
            </Button>
            <Button 
              variant="outline" 
              onClick={handleRefreshVideos} 
              disabled={isRefreshing}
              className="gap-2"
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              {isRefreshing ? "Lädt..." : "Neu laden"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
