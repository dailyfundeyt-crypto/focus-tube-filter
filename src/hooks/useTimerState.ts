import { useState, useEffect, useCallback } from "react";

const TIMER_STORAGE_KEY = "skill-timer-state";

export interface TimerState {
  timerCategory: string; // Category NAME
  timerCategoryId: string; // Category ID
  startTime: number | null;
  pausedElapsed: number;
  isRunning: boolean;
  lastConsumedTime: number; // Track how much time was already used for video tracking
}

export const useTimerState = () => {
  const [timerState, setTimerState] = useState<TimerState | null>(null);

  const loadState = useCallback(() => {
    const saved = localStorage.getItem(TIMER_STORAGE_KEY);
    if (saved) {
      try {
        const state: TimerState = JSON.parse(saved);
        // Add lastConsumedTime if not present (migration)
        if (state.lastConsumedTime === undefined) {
          state.lastConsumedTime = 0;
        }
        setTimerState(state);
        return state;
      } catch (e) {
        setTimerState(null);
        return null;
      }
    } else {
      setTimerState(null);
      return null;
    }
  }, []);

  useEffect(() => {
    loadState();

    const interval = setInterval(loadState, 1000);
    
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
  }, [loadState]);

  const getElapsedSeconds = useCallback((): number => {
    if (!timerState) return 0;
    
    if (timerState.isRunning && timerState.startTime) {
      const now = Date.now();
      const runningElapsed = Math.floor((now - timerState.startTime) / 1000);
      return timerState.pausedElapsed + runningElapsed;
    }
    return timerState.pausedElapsed;
  }, [timerState]);

  // Get available time (elapsed - already consumed)
  const getAvailableMinutes = useCallback((): number => {
    if (!timerState) return 0;
    const elapsed = getElapsedSeconds();
    const availableSeconds = elapsed - (timerState.lastConsumedTime || 0);
    return Math.floor(availableSeconds / 60);
  }, [timerState, getElapsedSeconds]);

  // Consume time from timer (mark as used for video tracking)
  const consumeTime = useCallback((minutes: number) => {
    const saved = localStorage.getItem(TIMER_STORAGE_KEY);
    if (!saved) return;

    try {
      const state: TimerState = JSON.parse(saved);
      state.lastConsumedTime = (state.lastConsumedTime || 0) + (minutes * 60);
      localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(state));
      setTimerState(state);
    } catch (e) {
      console.error("Error consuming timer time:", e);
    }
  }, []);

  const isTimerActive = timerState !== null && (timerState.isRunning || timerState.pausedElapsed > 0);
  const timerCategory = timerState?.timerCategory || null;

  return {
    timerState,
    isTimerActive,
    timerCategory,
    getElapsedSeconds,
    getAvailableMinutes,
    consumeTime,
  };
};
