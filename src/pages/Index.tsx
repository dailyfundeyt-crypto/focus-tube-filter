import { useState } from "react";
import { ChannelList } from "@/components/ChannelList";
import { AddChannelDialog } from "@/components/AddChannelDialog";
import { VideoGrid } from "@/components/VideoGrid";
import { Youtube } from "lucide-react";

const Index = () => {
  const [selectedChannel, setSelectedChannel] = useState<{
    id: string;
    name: string;
  } | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Youtube className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">Fokussierter YouTube Viewer</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-[300px_1fr] gap-8">
          {/* Sidebar */}
          <aside className="space-y-4">
            <AddChannelDialog />
            <ChannelList
              onChannelSelect={(id, name) => setSelectedChannel({ id, name })}
              selectedChannelId={selectedChannel?.id || null}
            />
          </aside>

          {/* Main Content */}
          <main>
            {selectedChannel ? (
              <VideoGrid channelId={selectedChannel.id} channelName={selectedChannel.name} />
            ) : (
              <div className="flex items-center justify-center h-[60vh] text-center">
                <div className="space-y-4">
                  <Youtube className="h-16 w-16 text-muted-foreground mx-auto" />
                  <div>
                    <h2 className="text-2xl font-semibold mb-2">
                      Wähle einen Kanal aus
                    </h2>
                    <p className="text-muted-foreground max-w-md">
                      Füge deine Lieblingskanäle hinzu und wähle einen aus, um die
                      neuesten langen Videos anzusehen - ohne Shorts oder ablenkende
                      Thumbnails.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Index;
