import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Trash2, ChevronRight, FolderClosed, FolderOpen, Pin } from "lucide-react";
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

interface Channel {
  id: string;
  channel_id: string;
  channel_name: string;
  channel_thumbnail: string | null;
  daily_video_goal: number;
  category: string | null;
  fetch_from_date: string | null;
}

interface ChannelListProps {
  onChannelSelect: (channelId: string, channelName: string, category?: string | null) => void;
  selectedChannelId: string | null;
}

export const ChannelList = ({ onChannelSelect, selectedChannelId }: ChannelListProps) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["uncategorized"]));

  // Fetch categories
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
      return data as { id: string; category_name: string; total_time_minutes: number }[];
    },
    enabled: !!user,
  });

  const { data: channels, isLoading } = useQuery({
    queryKey: ["channels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("youtube_channels")
        .select("*")
        .order("channel_name");
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
      toast.success("Kategorie aktualisiert");
    },
    onError: () => toast.error("Fehler beim Aktualisieren"),
  });

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryName)) {
        newSet.delete(categoryName);
      } else {
        newSet.add(categoryName);
      }
      return newSet;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-card rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!channels || channels.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Noch keine Kanäle</p>
        <p className="text-sm mt-1">Füge deinen ersten Kanal hinzu!</p>
      </div>
    );
  }

  // Group channels by category
  const channelsByCategory: Record<string, Channel[]> = { uncategorized: [] };
  categories.forEach((c) => (channelsByCategory[c.category_name] = []));
  channels.forEach((ch) => {
    const key = ch.category || "uncategorized";
    if (!channelsByCategory[key]) channelsByCategory[key] = [];
    channelsByCategory[key].push(ch);
  });

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} Min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const renderChannel = (channel: Channel) => (
    <div
      key={channel.id}
      className={`group flex items-center gap-3 p-2.5 rounded-lg transition-all cursor-pointer hover:bg-accent/50 ${
        selectedChannelId === channel.channel_id
          ? "bg-primary/10 border border-primary/30"
          : ""
      }`}
      onClick={() => onChannelSelect(channel.channel_id, channel.channel_name, channel.category)}
    >
      {channel.channel_thumbnail ? (
        <img
          src={channel.channel_thumbnail}
          alt={channel.channel_name}
          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-medium">{channel.channel_name[0]}</span>
        </div>
      )}
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{channel.channel_name}</p>
        <p className="text-xs text-muted-foreground">{channel.daily_video_goal || 1} Videos/Tag</p>
      </div>

      {/* Actions - always visible on mobile, hover on desktop */}
      <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
        <Select
          value={channel.category || "none"}
          onValueChange={(v) => updateCategoryMutation.mutate({ id: channel.id, category: v === "none" ? null : v })}
        >
          <SelectTrigger className="h-7 w-7 p-0 border-0 bg-transparent [&>svg]:hidden">
            <FolderClosed className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </SelectTrigger>
          <SelectContent className="bg-popover border border-border shadow-lg">
            <SelectItem value="none">Keine Kategorie</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.category_name}>
                {cat.category_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <ChannelGoalSettings
          channelId={channel.channel_id}
          channelName={channel.channel_name}
          currentGoal={channel.daily_video_goal || 1}
          currentFetchFromDate={channel.fetch_from_date}
          onGoalUpdate={() => queryClient.invalidateQueries({ queryKey: ["channels"] })}
        />
        
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => deleteMutation.mutate(channel.id)}
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  );

  const renderCategoryFolder = (categoryName: string, channelList: Channel[], totalMinutes?: number) => {
    if (channelList.length === 0 && categoryName === "uncategorized") return null;
    
    const isExpanded = expandedCategories.has(categoryName);
    const isUncategorized = categoryName === "uncategorized";
    const displayName = isUncategorized ? "Ohne Kategorie" : categoryName;

    return (
      <div key={categoryName} className="mb-2">
        {/* Apple-style folder header */}
        <button
          onClick={() => toggleCategory(categoryName)}
          className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-accent/50 transition-colors group"
        >
          <ChevronRight 
            className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
              isExpanded ? "rotate-90" : ""
            }`} 
          />
          
          {/* Apple-style folder icon */}
          <div className={`relative flex-shrink-0 ${isExpanded ? "text-blue-500" : "text-blue-400"}`}>
            {isExpanded ? (
              <FolderOpen className="h-5 w-5" />
            ) : (
              <FolderClosed className="h-5 w-5" />
            )}
          </div>
          
          <span className="flex-1 text-left text-sm font-medium truncate">
            {displayName}
          </span>
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {totalMinutes !== undefined && totalMinutes > 0 && (
              <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px] font-medium">
                {formatTime(totalMinutes)}
              </span>
            )}
            <span className="bg-muted px-1.5 py-0.5 rounded">
              {channelList.length}
            </span>
          </div>
        </button>

        {/* Expanded content */}
        {isExpanded && channelList.length > 0 && (
          <div className="ml-6 mt-1 space-y-0.5 border-l-2 border-muted pl-2">
            {channelList.map(renderChannel)}
          </div>
        )}
        
        {isExpanded && channelList.length === 0 && !isUncategorized && (
          <div className="ml-6 mt-1 py-3 text-xs text-muted-foreground border-l-2 border-muted pl-2">
            Keine Kanäle in dieser Kategorie
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-1">
      {/* Watch Later pinned item */}
      <div
        className={`flex items-center gap-3 p-2.5 rounded-lg transition-all cursor-pointer hover:bg-accent/50 ${
          selectedChannelId === "__watchlist__"
            ? "bg-primary/10 border border-primary/30"
            : ""
        }`}
        onClick={() => onChannelSelect("__watchlist__", "Später ansehen")}
      >
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Pin className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">📌 Später ansehen</p>
          <p className="text-xs text-muted-foreground">Deine Watchlist</p>
        </div>
      </div>

      <div className="my-2 border-t border-border" />

      {/* Render category folders */}
      {categories.map((cat) =>
        renderCategoryFolder(
          cat.category_name,
          channelsByCategory[cat.category_name] || [],
          cat.total_time_minutes
        )
      )}
      
      {/* Uncategorized channels */}
      {renderCategoryFolder("uncategorized", channelsByCategory.uncategorized)}
    </div>
  );
};
