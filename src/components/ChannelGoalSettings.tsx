import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ChannelGoalSettingsProps {
  channelId: string;
  channelName: string;
  currentGoal: number;
  onGoalUpdate: (newGoal: number) => void;
}

export function ChannelGoalSettings({ channelId, channelName, currentGoal, onGoalUpdate }: ChannelGoalSettingsProps) {
  const [goal, setGoal] = useState(currentGoal);
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("youtube_channels")
        .update({ daily_video_goal: goal })
        .eq("channel_id", channelId);

      if (error) throw error;

      onGoalUpdate(goal);
      toast.success("Tagesziel gespeichert");
      setOpen(false);
    } catch (error) {
      console.error("Error saving goal:", error);
      toast.error("Fehler beim Speichern");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tagesziel für {channelName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
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
          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            {isSaving ? "Speichert..." : "Speichern"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
