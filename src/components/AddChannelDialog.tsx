import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const AddChannelDialog = () => {
  const [open, setOpen] = useState(false);
  const [channelInput, setChannelInput] = useState("");
  const queryClient = useQueryClient();

  const addChannelMutation = useMutation({
    mutationFn: async (input: string) => {
      // First, get channel info from YouTube API
      const { data: channelData, error: functionError } = await supabase.functions.invoke(
        "youtube-channel-info",
        {
          body: { channelInput: input },
        }
      );

      if (functionError) throw functionError;
      if (!channelData) throw new Error("Kanal nicht gefunden");

      // Then save to database
      const { error: dbError } = await supabase.from("youtube_channels").insert({
        channel_id: channelData.channelId,
        channel_name: channelData.channelName,
        channel_thumbnail: channelData.channelThumbnail,
      });

      if (dbError) {
        if (dbError.code === "23505") {
          throw new Error("Dieser Kanal wurde bereits hinzugefügt");
        }
        throw dbError;
      }

      return channelData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      toast.success("Kanal erfolgreich hinzugefügt!");
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
