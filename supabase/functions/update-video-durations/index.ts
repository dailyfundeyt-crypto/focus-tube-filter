import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Parse ISO 8601 duration to seconds
function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0");
  const minutes = parseInt(match[2] || "0");
  const seconds = parseInt(match[3] || "0");
  return hours * 3600 + minutes * 60 + seconds;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!YOUTUBE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Service nicht konfiguriert" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get videos with 0 duration
    const { data: videos, error: fetchError } = await supabase
      .from("cached_videos")
      .select("id, video_id")
      .eq("duration_seconds", 0)
      .limit(50);

    if (fetchError) throw fetchError;
    if (!videos || videos.length === 0) {
      return new Response(
        JSON.stringify({ message: "Keine Videos zum Aktualisieren", updated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const videoIds = videos.map((v) => v.video_id);
    console.log(`Updating durations for ${videoIds.length} videos`);

    // Fetch video details from YouTube API
    const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?key=${YOUTUBE_API_KEY}&id=${videoIds.join(",")}&part=contentDetails`;
    const response = await fetch(detailsUrl);
    const data = await response.json();

    if (!data.items) {
      return new Response(
        JSON.stringify({ error: "YouTube API Fehler" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Update each video
    let updatedCount = 0;
    for (const item of data.items) {
      const durationSeconds = parseDuration(item.contentDetails?.duration || "");
      if (durationSeconds > 0) {
        const { error: updateError } = await supabase
          .from("cached_videos")
          .update({ duration_seconds: durationSeconds })
          .eq("video_id", item.id);

        if (!updateError) updatedCount++;
      }
    }

    console.log(`Updated ${updatedCount} video durations`);

    return new Response(
      JSON.stringify({ message: `${updatedCount} Videos aktualisiert`, updated: updatedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Fehler beim Aktualisieren" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
