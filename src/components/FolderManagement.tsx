import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Folder, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const FolderManagement = () => {
  const [newFolderName, setNewFolderName] = useState("");
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: folders = [], isLoading } = useQuery({
    queryKey: ["channel-folders", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("channel_folders")
        .select("*")
        .eq("user_id", user.id)
        .order("folder_name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const createFolder = useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error("Nicht angemeldet");
      const { error } = await supabase
        .from("channel_folders")
        .insert({ user_id: user.id, folder_name: name });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channel-folders"] });
      setNewFolderName("");
      toast.success("Ordner erstellt");
    },
    onError: () => toast.error("Fehler beim Erstellen"),
  });

  const deleteFolder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("channel_folders")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channel-folders"] });
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      toast.success("Ordner gelöscht");
    },
    onError: () => toast.error("Fehler beim Löschen"),
  });

  const handleCreate = () => {
    if (!newFolderName.trim()) return;
    createFolder.mutate(newFolderName.trim());
  };

  if (isLoading) {
    return <div className="text-muted-foreground">Lädt...</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Ordner verwalten</h3>
      
      <div className="flex gap-2">
        <Input
          placeholder="Neuer Ordnername"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        />
        <Button onClick={handleCreate} disabled={!newFolderName.trim()}>
          <Plus className="h-4 w-4 mr-1" />
          Erstellen
        </Button>
      </div>

      <div className="space-y-2">
        {folders.length === 0 ? (
          <p className="text-muted-foreground text-sm">Keine Ordner vorhanden</p>
        ) : (
          folders.map((folder) => (
            <div
              key={folder.id}
              className="flex items-center justify-between p-3 bg-card rounded-lg border"
            >
              <div className="flex items-center gap-2">
                <Folder className="h-4 w-4 text-muted-foreground" />
                <span>{folder.folder_name}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteFolder.mutate(folder.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
