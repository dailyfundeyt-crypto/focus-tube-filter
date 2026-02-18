import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface Category {
  id: string;
  category_name: string;
  total_time_minutes: number;
}

export const CategoryManagement = () => {
  const [newCategory, setNewCategory] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: categories, isLoading } = useQuery({
    queryKey: ["skill-categories", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("skill_categories")
        .select("*")
        .eq("user_id", user.id)
        .order("category_name");

      if (error) throw error;
      return data as Category[];
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (categoryName: string) => {
      if (!user) throw new Error("Nicht angemeldet");

      const { error } = await supabase
        .from("skill_categories")
        .insert({
          user_id: user.id,
          category_name: categoryName,
          total_time_minutes: 0,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skill-categories", user?.id] });
      toast.success("Kategorie erstellt");
      setNewCategory("");
    },
    onError: (error: Error) => {
      toast.error("Fehler beim Erstellen: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("skill_categories")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skill-categories", user?.id] });
      toast.success("Kategorie gelöscht");
    },
    onError: () => {
      toast.error("Fehler beim Löschen");
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, oldName, newName }: { id: string; oldName: string; newName: string }) => {
      // Update category name
      const { error } = await supabase
        .from("skill_categories")
        .update({ category_name: newName })
        .eq("id", id);
      if (error) throw error;

      // Also update all channels referencing the old category name
      await supabase
        .from("youtube_channels")
        .update({ category: newName })
        .eq("category", oldName);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skill-categories", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      toast.success("Kategorie umbenannt");
      setEditingId(null);
    },
    onError: () => {
      toast.error("Fehler beim Umbenennen");
    },
  });

  if (isLoading) {
    return <div className="text-center py-8">Lädt...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kategorien verwalten</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Neue Kategorie..."
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newCategory.trim()) {
                createMutation.mutate(newCategory.trim());
              }
            }}
          />
          <Button
            onClick={() => newCategory.trim() && createMutation.mutate(newCategory.trim())}
            disabled={!newCategory.trim() || createMutation.isPending}
          >
            <Plus className="h-4 w-4 mr-2" />
            Erstellen
          </Button>
        </div>

        <div className="space-y-2">
          {!categories || categories.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Noch keine Kategorien erstellt
            </p>
          ) : (
            categories.map((category) => (
              <div
                key={category.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card gap-2"
              >
                {editingId === category.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="h-8"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && editingName.trim()) {
                          renameMutation.mutate({ id: category.id, oldName: category.category_name, newName: editingName.trim() });
                        }
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => {
                        if (editingName.trim()) {
                          renameMutation.mutate({ id: category.id, oldName: category.category_name, newName: editingName.trim() });
                        }
                      }}
                    >
                      <Check className="h-4 w-4 text-green-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{category.category_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {Math.floor(category.total_time_minutes / 60)}h {category.total_time_minutes % 60}m
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingId(category.id);
                          setEditingName(category.category_name);
                        }}
                        className="hover:bg-accent"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(category.id)}
                        className="hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
