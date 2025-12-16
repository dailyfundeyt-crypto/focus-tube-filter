import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TIMER_STORAGE_KEY = "skill-timer-state";

interface TimerState {
  timerCategory: string;
  startTime: number | null;
  pausedElapsed: number;
  isRunning: boolean;
}

export const TimerIndicator = () => {
  const [timerState, setTimerState] = useState<TimerState | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const navigate = useNavigate();

  // Load and watch timer state
  useEffect(() => {
    const loadState = () => {
      const saved = localStorage.getItem(TIMER_STORAGE_KEY);
      if (saved) {
        try {
          const state: TimerState = JSON.parse(saved);
          setTimerState(state);
          
          if (state.isRunning && state.startTime) {
            const now = Date.now();
            const runningElapsed = Math.floor((now - state.startTime) / 1000);
            setElapsedSeconds(state.pausedElapsed + runningElapsed);
          } else {
            setElapsedSeconds(state.pausedElapsed);
          }
        } catch (e) {
          setTimerState(null);
        }
      } else {
        setTimerState(null);
      }
    };

    loadState();

    // Check for updates periodically
    const interval = setInterval(loadState, 1000);

    // Also listen for storage events from other tabs
    const handleStorage = (e: StorageEvent) => {
      if (e.key === TIMER_STORAGE_KEY) {
        loadState();
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  // Update elapsed time every second when running
  useEffect(() => {
    if (!timerState?.isRunning) return;

    const interval = setInterval(() => {
      if (timerState.startTime) {
        const now = Date.now();
        const runningElapsed = Math.floor((now - timerState.startTime) / 1000);
        setElapsedSeconds(timerState.pausedElapsed + runningElapsed);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timerState?.isRunning, timerState?.startTime, timerState?.pausedElapsed]);

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Don't show if no timer active
  if (!timerState || (elapsedSeconds === 0 && !timerState.isRunning)) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => navigate("/dashboard")}
      className={cn(
        "gap-2 font-mono",
        timerState.isRunning && "border-primary text-primary animate-pulse"
      )}
    >
      {timerState.isRunning ? (
        <Play className="h-3 w-3 fill-current" />
      ) : (
        <Pause className="h-3 w-3" />
      )}
      <Clock className="h-3 w-3" />
      <span>{formatTime(elapsedSeconds)}</span>
    </Button>
  );
};
