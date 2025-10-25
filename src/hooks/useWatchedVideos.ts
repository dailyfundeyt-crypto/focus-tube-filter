import { useState, useEffect } from "react";

const STORAGE_KEY = "watched-videos";

export const useWatchedVideos = () => {
  const [watchedVideos, setWatchedVideos] = useState<Set<string>>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...watchedVideos]));
  }, [watchedVideos]);

  const markAsWatched = (videoId: string) => {
    setWatchedVideos((prev) => new Set([...prev, videoId]));
  };

  const isWatched = (videoId: string) => {
    return watchedVideos.has(videoId);
  };

  const toggleWatched = (videoId: string) => {
    setWatchedVideos((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(videoId)) {
        newSet.delete(videoId);
      } else {
        newSet.add(videoId);
      }
      return newSet;
    });
  };

  return { markAsWatched, isWatched, toggleWatched };
};
