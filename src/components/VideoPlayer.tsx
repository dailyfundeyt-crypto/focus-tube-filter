import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
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
  onMarkAsWatched,
}: VideoPlayerProps) => {
  const hasMarkedAsWatched = useRef(false);

  // Reset the watched flag when video changes
  useEffect(() => {
    hasMarkedAsWatched.current = false;
  }, [videoId]);

  // Mark video as watched when closing
  const handleClose = useCallback(() => {
    if (videoId && !hasMarkedAsWatched.current && onMarkAsWatched) {
      onMarkAsWatched(videoId, durationMinutes);
      hasMarkedAsWatched.current = true;
    }
    onClose();
  }, [videoId, durationMinutes, onMarkAsWatched, onClose]);

  if (!videoId) return null;

  // Use simple iframe embed - much more stable with React
  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&modestbranding=1&rel=0&playsinline=1`;

  return (
    <Dialog open={!!videoId} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-5xl w-full p-0 overflow-hidden">
        <DialogTitle className="sr-only">{videoTitle}</DialogTitle>
        <DialogDescription className="sr-only">Video abspielen</DialogDescription>
        <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
          <iframe
            key={videoId}
            src={embedUrl}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={videoTitle}
          />
        </div>
        <div className="p-4">
          <h3 className="font-medium">{videoTitle}</h3>
        </div>
      </DialogContent>
    </Dialog>
  );
};
