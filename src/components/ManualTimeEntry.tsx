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
import { Plus, Clock, Play, Pause, Square, Info } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Category {
  id: string;
  category_name: string;
  total_time_minutes: number;
}

const TIMER_STORAGE_KEY = "skill-timer-state";

interface TimerState {
  timerCategory: string; // Category NAME (not ID) for use in video tracking
  timerCategoryId: string; // Category ID for saving
  startTime: number | null;
  pausedElapsed: number;
  isRunning: boolean;
  lastConsumedTime: number; // Seconds already used for video tracking
}

export const ManualTimeEntry = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  
  // Timer state
  const [timerCategoryId, setTimerCategoryId] = useState<string>("");
  const [timerCategoryName, setTimerCategoryName] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [pausedElapsed, setPausedElapsed] = useState(0);
  const [lastConsumedTime, setLastConsumedTime] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Load timer state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(TIMER_STORAGE_KEY);
    if (saved) {
      try {
        const state: TimerState = JSON.parse(saved);
        setTimerCategoryName(state.timerCategory || "");
        setTimerCategoryId(state.timerCategoryId || "");
        setPausedElapsed(state.pausedElapsed);
        setLastConsumedTime(state.lastConsumedTime || 0);
        
        if (state.isRunning && state.startTime) {
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
      timerCategory: timerCategoryName,
      timerCategoryId,
      startTime,
      pausedElapsed,
      isRunning,
      lastConsumedTime,
    };
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(state));
  }, [timerCategoryName, timerCategoryId, startTime, pausedElapsed, isRunning, lastConsumedTime]);

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

  // Calculate remaining time (not consumed by video tracking)
  const remainingSeconds = Math.max(0, elapsedSeconds - lastConsumedTime);
  const remainingMinutes = Math.floor(remainingSeconds / 60);
  const consumedMinutes = Math.floor(lastConsumedTime / 60);

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

      // Also update daily activity
      const today = new Date().toISOString().split("T")[0];
      const { data: existingActivity } = await supabase
        .from("daily_activity")
        .select("*")
        .eq("user_id", user.id)
        .eq("activity_date", today)
        .maybeSingle();

      if (existingActivity) {
        await supabase
          .from("daily_activity")
          .update({
            total_watch_time_minutes: existingActivity.total_watch_time_minutes + timeMinutes,
          })
          .eq("id", existingActivity.id);
      } else {
        await supabase.from("daily_activity").insert({
          user_id: user.id,
          activity_date: today,
          total_watch_time_minutes: timeMinutes,
          videos_watched: 0,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skill-categories", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["daily-activity"] });
      queryClient.invalidateQueries({ queryKey: ["year-activity"] });
      toast.success("Zeit hinzugefügt");
      setHours("");
      setMinutes("");
      setSelectedCategory("");
      // Reset timer state
      setElapsedSeconds(0);
      setTimerCategoryId("");
      setTimerCategoryName("");
      setStartTime(null);
      setPausedElapsed(0);
      setLastConsumedTime(0);
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

  const handleCategoryChange = (categoryId: string) => {
    setTimerCategoryId(categoryId);
    const category = categories?.find(c => c.id === categoryId);
    setTimerCategoryName(category?.category_name || "");
  };

  const handleStartTimer = () => {
    if (!timerCategoryId) {
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
    
    // Only save remaining time (not consumed by video tracking)
    if (remainingSeconds < 60) {
      if (lastConsumedTime > 0) {
        toast.info("Alle Zeit wurde bereits durch Videos verbraucht");
        handleResetTimer();
        return;
      }
      toast.error("Mindestens 1 Minute erforderlich");
      return;
    }

    if (!timerCategoryId) {
      toast.error("Bitte wähle eine Kategorie");
      return;
    }

    addTimeMutation.mutate({ categoryId: timerCategoryId, timeMinutes: remainingMinutes });
  };

  const handleResetTimer = () => {
    setIsRunning(false);
    setElapsedSeconds(0);
    setStartTime(null);
    setPausedElapsed(0);
    setLastConsumedTime(0);
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
              Starte den Timer während du lernst. Die Zeit wird automatisch für Videos verwendet, die du während des Timers anschaust.
            </p>

            <Select 
              value={timerCategoryId} 
              onValueChange={handleCategoryChange}
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
              {lastConsumedTime > 0 && (
                <div className="mt-2 text-sm text-muted-foreground">
                  <span className="text-primary">{consumedMinutes} Min</span> durch Videos verbraucht · 
                  <span className="text-foreground font-medium"> {remainingMinutes} Min</span> übrig
                </div>
              )}
            </div>

            {(isRunning || elapsedSeconds > 0) && (
              <Alert className="bg-primary/10 border-primary/20">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Wenn du Videos als gesehen markierst, wird die Timer-Zeit statt der Videolänge gezählt.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2 justify-center">
              {!isRunning ? (
                <Button
                  onClick={handleStartTimer}
                  disabled={!timerCategoryId}
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
                disabled={remainingSeconds < 60 || addTimeMutation.isPending}
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
