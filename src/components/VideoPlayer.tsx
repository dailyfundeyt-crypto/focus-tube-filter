import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useEffect, useRef, useState } from "react";
import { useTrackWatchedVideo } from "@/hooks/useTrackWatchedVideo";

interface VideoPlayerProps {
  videoId: string | null;
  videoTitle: string;
  channelId: string;
  durationSeconds: number;
  onClose: () => void;
  onVideoEnd: () => void;
}

export const VideoPlayer = ({ videoId, videoTitle, channelId, durationSeconds, onClose, onVideoEnd }: VideoPlayerProps) => {
  const playerRef = useRef<any>(null);
  const [hasTracked, setHasTracked] = useState(false);
  const { trackVideo } = useTrackWatchedVideo();

  useEffect(() => {
    if (!videoId) return;
    setHasTracked(false);

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
              // Track video when it ends
              if (!hasTracked && videoId) {
                trackVideo(videoId, channelId, durationSeconds);
                setHasTracked(true);
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
  }, [videoId, channelId, durationSeconds, onVideoEnd, trackVideo, hasTracked]);

  // Track video on close if user watched at least half
  const handleClose = () => {
    if (!hasTracked && videoId && playerRef.current && durationSeconds > 0) {
      const currentTime = playerRef.current.getCurrentTime?.() || 0;
      // Track if watched at least 50% or 1 minute
      if (currentTime >= durationSeconds * 0.5 || currentTime >= 60) {
        trackVideo(videoId, channelId, durationSeconds);
        setHasTracked(true);
      }
    }
    onClose();
  };

  return (
    <Dialog open={!!videoId} onOpenChange={handleClose}>
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
