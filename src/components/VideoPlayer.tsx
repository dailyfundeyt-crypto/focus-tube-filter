import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useEffect, useRef, useCallback } from "react";

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

export const VideoPlayer = ({ 
  videoId, 
  videoTitle, 
  durationMinutes,
  onClose, 
  onVideoEnd,
  onMarkAsWatched 
}: VideoPlayerProps) => {
  const playerRef = useRef<any>(null);
  const hasMarkedAsWatched = useRef(false);

  // Mark video as watched when closing
  const handleClose = useCallback(() => {
    if (videoId && !hasMarkedAsWatched.current && onMarkAsWatched) {
      onMarkAsWatched(videoId, durationMinutes);
      hasMarkedAsWatched.current = true;
    }
    onClose();
  }, [videoId, durationMinutes, onMarkAsWatched, onClose]);

  // Reset the watched flag when video changes
  useEffect(() => {
    hasMarkedAsWatched.current = false;
  }, [videoId]);

  useEffect(() => {
    if (!videoId) return;

    // Load YouTube IFrame API
    if (!(window as any).YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const initPlayer = () => {
      if (!(window as any).YT || !(window as any).YT.Player) return;

      // Destroy existing player if it exists
      if (playerRef.current) {
        playerRef.current.destroy();
      }

      playerRef.current = new (window as any).YT.Player("youtube-player", {
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          modestbranding: 1,
          rel: 0,
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

    if ((window as any).YT && (window as any).YT.Player) {
      initPlayer();
    } else {
      (window as any).onYouTubeIframeAPIReady = initPlayer;
    }

    // Cleanup function
    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [videoId, onVideoEnd, onMarkAsWatched, durationMinutes]);

  return (
    <Dialog open={!!videoId} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-5xl w-full p-0 overflow-hidden">
        <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
          <div id="youtube-player" className="absolute inset-0 w-full h-full" />
        </div>
        <div className="p-4">
          <h3 className="font-medium">{videoTitle}</h3>
        </div>
      </DialogContent>
    </Dialog>
  );
};
