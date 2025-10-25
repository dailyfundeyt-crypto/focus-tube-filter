import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useEffect } from "react";

interface VideoPlayerProps {
  videoId: string | null;
  videoTitle: string;
  onClose: () => void;
  onVideoEnd: () => void;
}

export const VideoPlayer = ({ videoId, videoTitle, onClose, onVideoEnd }: VideoPlayerProps) => {
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

      const player = new (window as any).YT.Player("youtube-player", {
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
              onVideoEnd();
            }
          },
        },
      });

      return player;
    };

    if ((window as any).YT && (window as any).YT.Player) {
      initPlayer();
    } else {
      (window as any).onYouTubeIframeAPIReady = initPlayer;
    }
  }, [videoId, onVideoEnd]);

  return (
    <Dialog open={!!videoId} onOpenChange={onClose}>
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
