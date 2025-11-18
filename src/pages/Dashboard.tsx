import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, ArrowLeft, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { YearActivityGrid } from "@/components/YearActivityGrid";
import { SkillProgress } from "@/components/SkillProgress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import logo from "@/assets/logo.png";

interface Channel {
  id: string;
  channel_id: string;
  channel_name: string;
  channel_thumbnail: string | null;
  daily_video_goal: number;
}

interface ChannelProgress extends Channel {
  watchedToday: number;
  progressPercentage: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);
  const { data: channels, isLoading: channelsLoading } = useQuery({
    queryKey: ["channels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("youtube_channels")
        .select("*")
        .order("channel_name");

      if (error) throw error;
      return data as Channel[];
    },
  });

  const { data: watchedVideos, isLoading: watchedLoading } = useQuery({
    queryKey: ["watched-videos-today"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("watched_videos")
        .select("channel_id, id")
        .gte("watched_at", today.toISOString());

      if (error) throw error;
      return data;
    },
  });

  const isLoading = channelsLoading || watchedLoading;

  const channelsWithProgress: ChannelProgress[] = (channels || []).map((channel) => {
    const watchedToday = watchedVideos?.filter((v) => v.channel_id === channel.channel_id).length || 0;
    const progressPercentage = Math.min((watchedToday / (channel.daily_video_goal || 1)) * 100, 100);

    return {
      ...channel,
      watchedToday,
      progressPercentage,
    };
  });

  const totalGoal = channelsWithProgress.reduce((sum, c) => sum + (c.daily_video_goal || 0), 0);
  const totalWatched = channelsWithProgress.reduce((sum, c) => sum + c.watchedToday, 0);
  const overallProgress = totalGoal > 0 ? (totalWatched / totalGoal) * 100 : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">Lädt...</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
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
              <h1 className="text-lg md:text-xl font-semibold">Dashboard</h1>
            </div>
            <div className="flex items-center gap-1 md:gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Zurück
              </Button>
              <ThemeToggle />
              <Button variant="outline" size="sm" onClick={signOut} className="hidden md:flex">
                <LogOut className="h-4 w-4 mr-2" />
                Abmelden
              </Button>
            </div>
          </div>
        </div>
      </header>
    <div className="container mx-auto p-6 space-y-6">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          <TabsTrigger value="activity">Aktivität</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
            <p className="text-muted-foreground">
              Übersicht über deinen Fortschritt bei allen Kanälen
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Gesamtfortschritt Heute</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {totalWatched} von {totalGoal} Videos
                  </span>
                  <span className="font-medium">{Math.round(overallProgress)}%</span>
                </div>
                <Progress value={overallProgress} className="h-3" />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {channelsWithProgress.map((channel) => (
              <Card key={channel.id} className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={channel.channel_thumbnail || ""} />
                      <AvatarFallback>{channel.channel_name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{channel.channel_name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Ziel: {channel.daily_video_goal} Videos/Tag
                      </p>
                    </div>
                    {channel.progressPercentage >= 100 ? (
                      <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0" />
                    ) : (
                      <Circle className="h-6 w-6 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {channel.watchedToday} von {channel.daily_video_goal}
                      </span>
                      <span className="font-medium">
                        {Math.round(channel.progressPercentage)}%
                      </span>
                    </div>
                    <Progress value={channel.progressPercentage} className="h-2" />
                  </div>

                  {channel.watchedToday >= channel.daily_video_goal && (
                    <div className="mt-3 text-sm text-green-600 dark:text-green-400 font-medium">
                      🎉 Tagesziel erreicht!
                    </div>
                  )}
                  {channel.watchedToday < channel.daily_video_goal && (
                    <div className="mt-3 text-sm text-muted-foreground">
                      Noch {channel.daily_video_goal - channel.watchedToday} Videos
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {channelsWithProgress.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <p>Keine Kanäle gefunden</p>
                <p className="text-sm mt-2">Füge Kanäle hinzu, um deinen Fortschritt zu sehen</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="activity" className="space-y-6 mt-6">
          <div>
            <h2 className="text-2xl font-bold mb-2">Jahresaktivität</h2>
            <p className="text-muted-foreground">
              Deine tägliche Lernaktivität im Überblick
            </p>
          </div>
          <Card>
            <CardContent className="pt-6">
              <YearActivityGrid />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="skills" className="space-y-6 mt-6">
          <div>
            <h2 className="text-2xl font-bold mb-2">Skill-Fortschritt</h2>
            <p className="text-muted-foreground">
              KI-basierte Kategorisierung deiner Lernfortschritte
            </p>
          </div>
          <SkillProgress />
        </TabsContent>
      </Tabs>
    </div>
    </div>
  );
}
