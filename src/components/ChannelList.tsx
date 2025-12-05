import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Trash2, Edit2, Folder, FolderOpen, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { ChannelGoalSettings } from "./ChannelGoalSettings";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface Channel {
  id: string;
  channel_id: string;
  channel_name: string;
  channel_thumbnail: string | null;
  daily_video_goal: number;
  category: string | null;
  folder_id: string | null;
}

interface ChannelFolder {
  id: string;
  folder_name: string;
}

interface ChannelListProps {
  onChannelSelect: (channelId: string, channelName: string) => void;
  selectedChannelId: string | null;
}

export const ChannelList = ({ onChannelSelect, selectedChannelId }: ChannelListProps) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState("");
  const [editFolderId, setEditFolderId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["unfiled"]));

  // Fetch folders
  const { data: folders = [] } = useQuery({
    queryKey: ["channel-folders", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("channel_folders")
        .select("*")
        .eq("user_id", user.id)
        .order("folder_name");
      if (error) throw error;
      return data as ChannelFolder[];
    },
    enabled: !!user,
  });

  // Fetch categories
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
      const { error } = await supabase.from("youtube_channels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      toast.success("Kanal entfernt");
    },
    onError: () => toast.error("Fehler beim Entfernen"),
  });

  const updateChannelMutation = useMutation({
    mutationFn: async ({ id, category, folder_id }: { id: string; category: string | null; folder_id: string | null }) => {
      const { error } = await supabase
        .from("youtube_channels")
        .update({ category, folder_id })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      setEditingChannelId(null);
      setEditCategory("");
      setEditFolderId(null);
      toast.success("Kanal aktualisiert");
    },
    onError: () => toast.error("Fehler beim Aktualisieren"),
  });

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

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

  // Group channels by folder
  const channelsByFolder: Record<string, Channel[]> = { unfiled: [] };
  folders.forEach((f) => (channelsByFolder[f.id] = []));
  channels.forEach((c) => {
    const key = c.folder_id || "unfiled";
    if (!channelsByFolder[key]) channelsByFolder[key] = [];
    channelsByFolder[key].push(c);
  });

  const renderChannel = (channel: Channel) => (
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
              setEditFolderId(channel.folder_id);
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
        <div className="mt-2 space-y-3" onClick={(e) => e.stopPropagation()}>
          <div>
            <Label>Ordner</Label>
            <Select
              value={editFolderId || "none"}
              onValueChange={(v) => setEditFolderId(v === "none" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Ordner wählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Kein Ordner</SelectItem>
                {folders.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.folder_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Kategorie</Label>
            {categories && categories.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 mt-1">
                {categories.map((cat) => (
                  <Button
                    key={cat.id}
                    size="sm"
                    variant={editCategory === cat.category_name ? "default" : "outline"}
                    onClick={() => setEditCategory(editCategory === cat.category_name ? "" : cat.category_name)}
                  >
                    {cat.category_name}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Keine Kategorien vorhanden</p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() =>
                updateChannelMutation.mutate({
                  id: channel.id,
                  category: editCategory || null,
                  folder_id: editFolderId,
                })
              }
            >
              Speichern
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingChannelId(null);
                setEditCategory("");
                setEditFolderId(null);
              }}
            >
              Abbrechen
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const renderFolderSection = (folderId: string, folderName: string, channelList: Channel[]) => {
    if (channelList.length === 0) return null;
    const isExpanded = expandedFolders.has(folderId);

    return (
      <div key={folderId} className="space-y-2">
        <button
          onClick={() => toggleFolder(folderId)}
          className="flex items-center gap-2 w-full text-left py-2 px-2 rounded hover:bg-accent transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          {folderId === "unfiled" ? (
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Folder className="h-4 w-4 text-primary" />
          )}
          <span className="font-medium">{folderName}</span>
          <span className="text-xs text-muted-foreground">({channelList.length})</span>
        </button>
        {isExpanded && <div className="space-y-2 ml-6">{channelList.map(renderChannel)}</div>}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {folders.map((folder) =>
        renderFolderSection(folder.id, folder.folder_name, channelsByFolder[folder.id] || [])
      )}
      {renderFolderSection("unfiled", "Ohne Ordner", channelsByFolder.unfiled)}
    </div>
  );
};
