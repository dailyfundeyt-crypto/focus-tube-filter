import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { ChannelGoalSettings } from "./ChannelGoalSettings";
import { useState } from "react";

interface Channel {
  id: string;
  channel_id: string;
  channel_name: string;
  channel_thumbnail: string | null;
  daily_video_goal: number;
  category: string | null;
}

interface ChannelListProps {
  onChannelSelect: (channelId: string, channelName: string) => void;
  selectedChannelId: string | null;
}

export const ChannelList = ({ onChannelSelect, selectedChannelId }: ChannelListProps) => {
  const queryClient = useQueryClient();
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState("");

  // Fetch available categories
  const { data: categories } = useQuery({
    queryKey: ["skill-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skill_categories")
        .select("*")
        .order("category_name");

      if (error) throw error;
      return data as { id: string; category_name: string }[];
    },
  });

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

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, category }: { id: string; category: string | null }) => {
      const { error } = await supabase
        .from("youtube_channels")
        .update({ category })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      setEditingChannelId(null);
      setEditCategory("");
      toast.success("Kategorie aktualisiert");
    },
    onError: () => {
      toast.error("Fehler beim Aktualisieren der Kategorie");
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
          className={`flex flex-col gap-2 p-3 rounded-lg border transition-all cursor-pointer hover:border-primary/50 ${
            selectedChannelId === channel.channel_id
              ? "border-primary bg-primary/5"
              : "border-border bg-card"
          }`}
          onClick={() => onChannelSelect(channel.channel_id, channel.channel_name)}
        >
          <div className="flex items-center gap-3">
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
              {channel.category && (
                <p className="text-xs text-muted-foreground">
                  Kategorie: <span className="font-medium">{channel.category}</span>
                </p>
              )}
            </div>
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditingChannelId(channel.id);
                  setEditCategory(channel.category || "");
                }}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              <ChannelGoalSettings
                channelId={channel.channel_id}
                channelName={channel.channel_name}
                currentGoal={channel.daily_video_goal || 1}
                onGoalUpdate={() => queryClient.invalidateQueries({ queryKey: ["channels"] })}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteMutation.mutate(channel.id)}
                className="hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {editingChannelId === channel.id && (
            <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
              <Label htmlFor={`category-${channel.id}`}>Kategorie zuweisen</Label>
              <div className="flex flex-col gap-2">
                {categories && categories.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {categories.map((cat) => (
                      <Button
                        key={cat.id}
                        size="sm"
                        variant={editCategory === cat.category_name ? "default" : "outline"}
                        onClick={() => setEditCategory(cat.category_name)}
                      >
                        {cat.category_name}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Keine Kategorien verfügbar. Erstelle zuerst Kategorien im Skills-Tab.
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => updateCategoryMutation.mutate({ id: channel.id, category: editCategory || null })}
                    disabled={!editCategory}
                  >
                    Speichern
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingChannelId(null);
                      setEditCategory("");
                    }}
                  >
                    Abbrechen
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
