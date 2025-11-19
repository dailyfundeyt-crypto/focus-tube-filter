import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChannelList } from "@/components/ChannelList";
import { AddChannelDialog } from "@/components/AddChannelDialog";
import { VideoGrid } from "@/components/VideoGrid";
import { InstallPWA } from "@/components/InstallPWA";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { LogOut, RefreshCw, Youtube, BarChart3 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WatchedVideosTab } from "@/components/WatchedVideosTab";

const Index = () => {
  const [selectedChannel, setSelectedChannel] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: channels } = useQuery({
    queryKey: ["channels", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("youtube_channels")
        .select("*")
        .eq("user_id", user.id)
        .order("added_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const handleRefreshVideos = async () => {
    if (!selectedChannel || !user) return;
    
    setIsRefreshing(true);
    
    // Helper to parse ISO 8601 duration (PT#H#M#S) to seconds
    const parseDuration = (duration: string): number => {
      const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (!match) return 0;
      const hours = parseInt(match[1] || "0");
      const minutes = parseInt(match[2] || "0");
      const seconds = parseInt(match[3] || "0");
      return hours * 3600 + minutes * 60 + seconds;
    };

    try {
      console.log("Refreshing videos for channel:", selectedChannel.id);

      // Ensure the channel has an AI category
      try {
        const { data: channelRow } = await supabase
          .from("youtube_channels")
          .select("channel_name, category")
          .eq("user_id", user.id)
          .eq("channel_id", selectedChannel.id)
          .single();

        if (channelRow && !channelRow.category) {
          const { data: categoryData, error: categoryError } = await supabase.functions.invoke(
            "categorize-channel",
            {
              body: { channelName: channelRow.channel_name },
            }
          );

          const category = categoryError ? "Sonstiges" : categoryData?.category || "Sonstiges";

          await supabase
            .from("youtube_channels")
            .update({ category })
            .eq("user_id", user.id)
            .eq("channel_id", selectedChannel.id);
        }
      } catch (categoryError) {
        console.error("Error ensuring channel category on refresh:", categoryError);
      }
      
      let allVideos: any[] = [];
      let pageToken: string | null = null;
      let pageCount = 0;
      
      // Fetch all pages
      do {
        pageCount++;
        console.log(`Refreshing page ${pageCount}, token:`, pageToken);
        
        const { data, error } = await supabase.functions.invoke("youtube-videos", {
          body: { 
            channelId: selectedChannel.id,
            pageToken,
            order: "date",
          },
        });

        if (error) throw error;

        const videos = data.videos || [];
        allVideos.push(...videos);
        pageToken = data.nextPageToken;
        
        console.log(`Page ${pageCount}: ${videos.length} videos, total so far: ${allVideos.length}`);
      } while (pageToken && pageCount < 20); // Safety limit of 20 pages
      
      console.log(`Finished refreshing all pages. Total videos: ${allVideos.length}`);
      
      // Delete old cached videos for this channel first
      await supabase
        .from("cached_videos")
        .delete()
        .eq("user_id", user.id)
        .eq("channel_id", selectedChannel.id);
      
      // Insert new videos with parsed duration
      for (const video of allVideos) {
        await supabase.from("cached_videos").insert({
          user_id: user.id,
          channel_id: selectedChannel.id,
          video_id: video.id,
          title: video.snippet.title,
          thumbnail: video.snippet.thumbnails.medium.url,
          published_at: video.snippet.publishedAt,
          video_url: `https://www.youtube.com/watch?v=${video.id}`,
          duration_seconds: parseDuration(video.contentDetails?.duration || "PT0S"),
        });
      }

      toast({ title: "Videos aktualisiert!", description: `${allVideos.length} Videos geladen` });
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
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 md:gap-3">
              <img src={logo} alt="Logo" className="h-8 md:h-10 w-auto object-contain" />
              <h1 className="text-lg md:text-xl font-semibold">YouTube Viewer</h1>
            </div>
            <div className="flex items-center gap-1 md:gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/dashboard")}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
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
              <Button variant="outline" size="sm" onClick={signOut} className="hidden md:flex">
                <LogOut className="h-4 w-4 mr-2" />
                Abmelden
              </Button>
              <Button variant="outline" size="sm" onClick={signOut} className="md:hidden">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-[280px_1fr] gap-6">
          {/* Sidebar */}
          <aside className="space-y-4">
            <AddChannelDialog />
            <div className="lg:block hidden">
              <ChannelList
                onChannelSelect={(id, name) => setSelectedChannel({ id, name })}
                selectedChannelId={selectedChannel?.id || null}
              />
            </div>
            
            {/* Mobile Channel Selector */}
            <div className="lg:hidden">
              <select
                className="w-full p-3 rounded-lg border border-border bg-card text-foreground"
                value={selectedChannel?.id || ""}
                onChange={(e) => {
                  const channelId = e.target.value;
                  const channelName = e.target.options[e.target.selectedIndex].text;
                  if (channelId) {
                    setSelectedChannel({ id: channelId, name: channelName });
                  } else {
                    setSelectedChannel(null);
                  }
                }}
              >
                <option value="">Kanal auswählen...</option>
                {channels?.map((channel) => (
                  <option key={channel.id} value={channel.channel_id}>
                    {channel.channel_name}
                  </option>
                ))}
              </select>
            </div>
          </aside>

          {/* Main Content */}
          <main>
            {selectedChannel ? (
              <Tabs defaultValue="unwatched" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="unwatched">Ungesehen</TabsTrigger>
                  <TabsTrigger value="watched">Gesehen</TabsTrigger>
                </TabsList>
                
                <TabsContent value="unwatched">
                  <VideoGrid channelId={selectedChannel.id} channelName={selectedChannel.name} />
                </TabsContent>
                
                <TabsContent value="watched">
                  <WatchedVideosTab channelId={selectedChannel.id} channelName={selectedChannel.name} />
                </TabsContent>
              </Tabs>
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
