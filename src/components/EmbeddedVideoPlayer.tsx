import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface EmbeddedVideoPlayerProps {
  videoId: string | null;
  videoTitle: string;
  onClose: () => void;
}

export const EmbeddedVideoPlayer = ({ videoId, videoTitle, onClose }: EmbeddedVideoPlayerProps) => {
  if (!videoId) return null;

  return (
    <Dialog open={!!videoId} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>{videoTitle}</DialogTitle>
        </DialogHeader>
        <div className="aspect-video w-full">
          <iframe
            width="100%"
            height="100%"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
            title={videoTitle}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="rounded-b-lg"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
