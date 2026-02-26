import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, ExternalLink, Wrench } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const ToolsGrid = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const { data: links, isLoading } = useQuery({
    queryKey: ["saved-links", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("saved_links")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Nicht angemeldet");
      if (!url.trim() || !title.trim()) throw new Error("URL und Titel sind erforderlich");

      let formattedUrl = url.trim();
      if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
        formattedUrl = `https://${formattedUrl}`;
      }

      const { error } = await supabase.from("saved_links").insert({
        user_id: user.id,
        url: formattedUrl,
        title: title.trim(),
        description: description.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-links"] });
      toast.success("Link gespeichert");
      setUrl("");
      setTitle("");
      setDescription("");
      setOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Fehler beim Speichern");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("saved_links").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-links"] });
      toast.success("Link entfernt");
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-3">
            <div className="h-32 bg-card rounded-lg animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">🛠️ Tools</h2>
          <p className="text-muted-foreground">
            {links?.length || 0} {(links?.length || 0) === 1 ? "Link" : "Links"} gespeichert
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Link hinzufügen
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Link speichern</DialogTitle>
              <DialogDescription>
                Speichere einen Link zu einem nützlichen Tool oder einer Website
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="linkTitle">Titel</Label>
                <Input
                  id="linkTitle"
                  placeholder="z.B. Figma, Notion, ChatGPT..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="linkUrl">URL</Label>
                <Input
                  id="linkUrl"
                  placeholder="https://..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="linkDesc">Beschreibung (optional)</Label>
                <Input
                  id="linkDesc"
                  placeholder="Wofür ist dieser Link?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <Button
                onClick={() => addMutation.mutate()}
                disabled={addMutation.isPending || !url.trim() || !title.trim()}
                className="w-full"
              >
                {addMutation.isPending ? "Wird gespeichert..." : "Speichern"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {!links || links.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Noch keine Links gespeichert</p>
          <p className="text-sm mt-2">
            Speichere Links zu Tools und Websites, die du regelmäßig brauchst
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {links.map((link) => (
            <Card
              key={link.id}
              className="group overflow-hidden transition-all hover:shadow-lg border-border cursor-pointer"
              onClick={() => window.open(link.url, "_blank", "noopener,noreferrer")}
            >
              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${new URL(link.url).hostname}&sz=32`}
                      alt=""
                      className="w-5 h-5 flex-shrink-0 rounded"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    <h3 className="font-semibold text-foreground truncate">{link.title}</h3>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                {link.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {link.description}
                  </p>
                )}

                <p className="text-xs text-muted-foreground truncate">
                  {new URL(link.url).hostname}
                </p>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteMutation.mutate(link.id);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Entfernen
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
