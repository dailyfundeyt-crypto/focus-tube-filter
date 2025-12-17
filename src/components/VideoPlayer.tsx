import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useEffect, useRef, useCallback, useState } from "react";

interface VideoPlayerProps {
  videoId: string | null;
  videoTitle: string;
  channelId: string;
  channelName: string;
  durationMinutes: number;
  onClose: () => void;
  onVideoEnd: () => void;
  onMarkAsWatched?: (videoId: string, durationMinutes: number) => void;
}

const YT_IFRAME_API_SRC = "https://www.youtube.com/iframe_api";

let ytApiReadyPromise: Promise<void> | null = null;

const ensureYouTubeIframeAPI = () => {
  if ((window as any).YT?.Player) return Promise.resolve();

  if (ytApiReadyPromise) return ytApiReadyPromise;

  ytApiReadyPromise = new Promise<void>((resolve) => {
    // Load script once
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${YT_IFRAME_API_SRC}"]`
    );

    if (!existingScript) {
      const tag = document.createElement("script");
      tag.src = YT_IFRAME_API_SRC;
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    }

    // Preserve any existing callback
    const prevReady = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      try {
        if (typeof prevReady === "function") prevReady();
      } catch {
        // ignore
      }
      resolve();
    };

    // Fallback: if callback already fired (or gets missed), poll until ready
    const poll = () => {
      if ((window as any).YT?.Player) {
        resolve();
        return;
      }
      setTimeout(poll, 50);
    };
    poll();
  });

  return ytApiReadyPromise;
};

export const VideoPlayer = ({
  videoId,
  videoTitle,
  durationMinutes,
  onClose,
  onVideoEnd,
  onMarkAsWatched,
}: VideoPlayerProps) => {
  const playerRef = useRef<any>(null);
  const hasMarkedAsWatched = useRef(false);
  const [playerKey, setPlayerKey] = useState(0);

  // Mark video as watched when closing
  const handleClose = useCallback(() => {
    if (videoId && !hasMarkedAsWatched.current && onMarkAsWatched) {
      onMarkAsWatched(videoId, durationMinutes);
      hasMarkedAsWatched.current = true;
    }

    // Destroy player before closing
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
      } catch {
        // Ignore errors during cleanup
      }
      playerRef.current = null;
    }

    // Increment key to force new player element on next open
    setPlayerKey((k) => k + 1);
    onClose();
  }, [videoId, durationMinutes, onMarkAsWatched, onClose]);

  // Reset the watched flag when video changes
  useEffect(() => {
    hasMarkedAsWatched.current = false;
  }, [videoId]);

  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;

    // Force a fresh container element
    setPlayerKey((k) => k + 1);

    const initPlayer = async () => {
      await ensureYouTubeIframeAPI();
      if (cancelled) return;

      // Destroy any existing player
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }
        playerRef.current = null;
      }

      const containerId = `youtube-player-${videoId}`;

      // The dialog content is portaled and animated; the container might not be in the DOM yet.
      const mountPlayer = (attempt = 0) => {
        if (cancelled) return;

        const el = document.getElementById(containerId);
        if (!el) {
          if (attempt < 80) {
            setTimeout(() => mountPlayer(attempt + 1), 50);
          } else {
            console.warn("[VideoPlayer] Container not mounted in time:", containerId);
          }
          return;
        }

        if (cancelled) return;

        playerRef.current = new (window as any).YT.Player(containerId, {
          videoId,
          playerVars: {
            autoplay: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
          },
          events: {
            onStateChange: (event: any) => {
              // 0 = ended
              if (event.data === 0) {
                if (!hasMarkedAsWatched.current && onMarkAsWatched) {
                  onMarkAsWatched(videoId, durationMinutes);
                  hasMarkedAsWatched.current = true;
                }
                onVideoEnd();
              }
            },
          },
        });
      };

      mountPlayer();
    };

    initPlayer();

    return () => {
      cancelled = true;
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }
        playerRef.current = null;
      }
    };
  }, [videoId, onVideoEnd, onMarkAsWatched, durationMinutes]);

  return (
    <Dialog open={!!videoId} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-5xl w-full p-0 overflow-hidden">
        <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
          {videoId && (
            <div
              key={`${videoId}-${playerKey}`}
              id={`youtube-player-${videoId}`}
              className="absolute inset-0 w-full h-full"
            />
          )}
        </div>
        <div className="p-4">
          <h3 className="font-medium">{videoTitle}</h3>
        </div>
      </DialogContent>
    </Dialog>
  );
};
