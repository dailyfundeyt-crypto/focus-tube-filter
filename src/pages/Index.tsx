import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChannelList } from "@/components/ChannelList";
import { AddChannelDialog } from "@/components/AddChannelDialog";
import { VideoGrid } from "@/components/VideoGrid";
import { InstallPWA } from "@/components/InstallPWA";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { LogOut, RefreshCw, Youtube } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";

const Index = () => {
  const [selectedChannel, setSelectedChannel] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const handleRefreshVideos = async () => {
    if (!selectedChannel || !user) return;
    
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("youtube-videos", {
        body: { 
          channelId: selectedChannel.id,
          pageToken: null,
          order: "date"
        },
      });

      if (error) throw error;

      const videos = data.videos || [];
      
      // Delete old cached videos for this channel first
      await supabase
        .from("cached_videos")
        .delete()
        .eq("user_id", user.id)
        .eq("channel_id", selectedChannel.id);
      
      // Insert new videos
      for (const video of videos) {
        await supabase.from("cached_videos").insert({
          user_id: user.id,
          channel_id: selectedChannel.id,
          video_id: video.id,
          title: video.snippet.title,
          thumbnail: video.snippet.thumbnails.medium.url,
          published_at: video.snippet.publishedAt,
          video_url: `https://www.youtube.com/watch?v=${video.id}`,
        });
      }

      toast({ title: "Videos aktualisiert!", description: `${videos.length} Videos geladen` });
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">Lädt...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Logo" className="h-10 w-auto object-contain" />
              <h1 className="text-xl font-semibold">YouTube Viewer</h1>
            </div>
            <div className="flex items-center gap-2">
              {selectedChannel && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshVideos}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Updaten
                </Button>
              )}
              <ThemeToggle />
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Abmelden
              </Button>
            </div>
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
      <InstallPWA />
    </div>
  );
};

export default Index;
