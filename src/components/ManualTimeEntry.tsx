import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Clock } from "lucide-react";
import { toast } from "sonner";

interface Category {
  id: string;
  category_name: string;
  total_time_minutes: number;
}

export const ManualTimeEntry = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: categories } = useQuery({
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

  const addTimeMutation = useMutation({
    mutationFn: async ({ categoryId, timeMinutes }: { categoryId: string; timeMinutes: number }) => {
      if (!user) throw new Error("Nicht angemeldet");

      const category = categories?.find((c) => c.id === categoryId);
      if (!category) throw new Error("Kategorie nicht gefunden");

      const newTotal = category.total_time_minutes + timeMinutes;

      const { error } = await supabase
        .from("skill_categories")
        .update({ total_time_minutes: newTotal })
        .eq("id", categoryId)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skill-categories", user?.id] });
      toast.success("Zeit hinzugefügt");
      setHours("");
      setMinutes("");
      setSelectedCategory("");
    },
    onError: (error: Error) => {
      toast.error("Fehler: " + error.message);
    },
  });

  const handleAddTime = () => {
    const h = parseInt(hours) || 0;
    const m = parseInt(minutes) || 0;
    const totalMinutes = h * 60 + m;

    if (totalMinutes <= 0) {
      toast.error("Bitte gib eine gültige Zeit ein");
      return;
    }

    if (!selectedCategory) {
      toast.error("Bitte wähle eine Kategorie");
      return;
    }

    addTimeMutation.mutate({ categoryId: selectedCategory, timeMinutes: totalMinutes });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Zeit manuell hinzufügen
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Füge Zeit hinzu, die du außerhalb der App gelernt hast.
        </p>

        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger>
            <SelectValue placeholder="Kategorie wählen..." />
          </SelectTrigger>
          <SelectContent>
            {categories?.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.category_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              type="number"
              placeholder="Stunden"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              min="0"
            />
          </div>
          <div className="flex-1">
            <Input
              type="number"
              placeholder="Minuten"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              min="0"
              max="59"
            />
          </div>
        </div>

        <Button
          onClick={handleAddTime}
          disabled={!selectedCategory || addTimeMutation.isPending}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Zeit hinzufügen
        </Button>
      </CardContent>
    </Card>
  );
};
