import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ChannelGoalSettings } from "./ChannelGoalSettings";

interface Channel {
  id: string;
  channel_id: string;
  channel_name: string;
  channel_thumbnail: string | null;
  daily_video_goal: number;
}

interface ChannelListProps {
  onChannelSelect: (channelId: string, channelName: string) => void;
  selectedChannelId: string | null;
}

export const ChannelList = ({ onChannelSelect, selectedChannelId }: ChannelListProps) => {
  const queryClient = useQueryClient();

  const { data: channels, isLoading } = useQuery({
    queryKey: ["channels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("youtube_channels")
        .select("*")
        .order("added_at", { ascending: false });

      if (error) throw error;
      return data as Channel[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("youtube_channels")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      toast.success("Kanal entfernt");
    },
    onError: () => {
      toast.error("Fehler beim Entfernen des Kanals");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-card rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!channels || channels.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Noch keine Kanäle hinzugefügt</p>
        <p className="text-sm mt-2">Füge deinen ersten YouTube-Kanal hinzu!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {channels.map((channel) => (
        <div
          key={channel.id}
          className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer hover:border-primary/50 ${
            selectedChannelId === channel.channel_id
              ? "border-primary bg-primary/5"
              : "border-border bg-card"
          }`}
          onClick={() => onChannelSelect(channel.channel_id, channel.channel_name)}
        >
          {channel.channel_thumbnail && (
            <img
              src={channel.channel_thumbnail}
              alt={channel.channel_name}
              className="w-10 h-10 rounded-full"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{channel.channel_name}</p>
            <p className="text-xs text-muted-foreground">Tagesziel: {channel.daily_video_goal || 1} Videos</p>
          </div>
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            <ChannelGoalSettings
              channelId={channel.channel_id}
              channelName={channel.channel_name}
              currentGoal={channel.daily_video_goal || 1}
              onGoalUpdate={() => queryClient.invalidateQueries({ queryKey: ["channels"] })}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                deleteMutation.mutate(channel.id);
              }}
              className="hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};
