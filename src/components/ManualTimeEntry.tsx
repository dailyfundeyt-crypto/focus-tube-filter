import { useState, useEffect, useRef } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Clock, Play, Pause, Square } from "lucide-react";
import { toast } from "sonner";

interface Category {
  id: string;
  category_name: string;
  total_time_minutes: number;
}

const TIMER_STORAGE_KEY = "skill-timer-state";

interface TimerState {
  timerCategory: string;
  startTime: number | null; // timestamp when timer started
  pausedElapsed: number; // seconds elapsed when paused
  isRunning: boolean;
}

export const ManualTimeEntry = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  
  // Timer state
  const [timerCategory, setTimerCategory] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [pausedElapsed, setPausedElapsed] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Load timer state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(TIMER_STORAGE_KEY);
    if (saved) {
      try {
        const state: TimerState = JSON.parse(saved);
        setTimerCategory(state.timerCategory);
        setPausedElapsed(state.pausedElapsed);
        
        if (state.isRunning && state.startTime) {
          // Calculate elapsed time since start
          const now = Date.now();
          const runningElapsed = Math.floor((now - state.startTime) / 1000);
          setElapsedSeconds(state.pausedElapsed + runningElapsed);
          setStartTime(state.startTime);
          setIsRunning(true);
        } else {
          setElapsedSeconds(state.pausedElapsed);
        }
      } catch (e) {
        console.error("Failed to parse timer state", e);
      }
    }
  }, []);

  // Save timer state to localStorage whenever it changes
  useEffect(() => {
    const state: TimerState = {
      timerCategory,
      startTime,
      pausedElapsed,
      isRunning,
    };
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(state));
  }, [timerCategory, startTime, pausedElapsed, isRunning]);

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

  // Timer logic
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const addTimeMutation = useMutation({
    mutationFn: async ({ categoryId, timeMinutes }: { categoryId: string; timeMinutes: number }) => {
      if (!user) throw new Error("Nicht angemeldet");

      // Fetch current value directly from database to avoid stale data
      const { data: currentCategory, error: fetchError } = await supabase
        .from("skill_categories")
        .select("total_time_minutes")
        .eq("id", categoryId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!currentCategory) throw new Error("Kategorie nicht gefunden");

      const newTotal = (currentCategory.total_time_minutes || 0) + timeMinutes;

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
      // Reset timer state
      setElapsedSeconds(0);
      setTimerCategory("");
      setStartTime(null);
      setPausedElapsed(0);
      localStorage.removeItem(TIMER_STORAGE_KEY);
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

  const handleStartTimer = () => {
    if (!timerCategory) {
      toast.error("Bitte wähle zuerst eine Kategorie");
      return;
    }
    setStartTime(Date.now());
    setIsRunning(true);
  };

  const handlePauseTimer = () => {
    setIsRunning(false);
    setPausedElapsed(elapsedSeconds);
    setStartTime(null);
  };

  const handleStopAndSave = () => {
    setIsRunning(false);
    
    if (elapsedSeconds < 60) {
      toast.error("Mindestens 1 Minute erforderlich");
      return;
    }

    if (!timerCategory) {
      toast.error("Bitte wähle eine Kategorie");
      return;
    }

    const totalMinutes = Math.floor(elapsedSeconds / 60);
    addTimeMutation.mutate({ categoryId: timerCategory, timeMinutes: totalMinutes });
  };

  const handleResetTimer = () => {
    setIsRunning(false);
    setElapsedSeconds(0);
    setStartTime(null);
    setPausedElapsed(0);
    localStorage.removeItem(TIMER_STORAGE_KEY);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Zeit hinzufügen
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="timer" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="timer">Stoppuhr</TabsTrigger>
            <TabsTrigger value="manual">Manuell</TabsTrigger>
          </TabsList>

          <TabsContent value="timer" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Starte den Timer während du lernst.
            </p>

            <Select 
              value={timerCategory} 
              onValueChange={setTimerCategory}
              disabled={isRunning}
            >
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

            <div className="text-center py-6">
              <div className="text-5xl font-mono font-bold tracking-wider">
                {formatTime(elapsedSeconds)}
              </div>
            </div>

            <div className="flex gap-2 justify-center">
              {!isRunning ? (
                <Button
                  onClick={handleStartTimer}
                  disabled={!timerCategory}
                  className="flex-1 max-w-32"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start
                </Button>
              ) : (
                <Button
                  onClick={handlePauseTimer}
                  variant="outline"
                  className="flex-1 max-w-32"
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </Button>
              )}
              
              <Button
                onClick={handleStopAndSave}
                disabled={elapsedSeconds < 60 || addTimeMutation.isPending}
                variant="default"
                className="flex-1 max-w-32"
              >
                <Square className="h-4 w-4 mr-2" />
                Speichern
              </Button>
            </div>

            {elapsedSeconds > 0 && (
              <Button
                onClick={handleResetTimer}
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
              >
                Zurücksetzen
              </Button>
            )}
          </TabsContent>

          <TabsContent value="manual" className="space-y-4">
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
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
