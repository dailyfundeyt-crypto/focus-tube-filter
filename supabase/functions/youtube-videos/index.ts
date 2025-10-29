import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const videosRequestSchema = z.object({
  channelId: z.string().trim().min(1, "Channel ID is required").max(100, "Channel ID too long"),
  pageToken: z.string().max(200, "Page token too long").optional().nullable(),
  order: z.enum(["date", "rating", "relevance", "title", "viewCount"]).optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const validationResult = videosRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: 'Ungültige Eingabe' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    const { channelId, pageToken = null, order = "date" } = validationResult.data;
    const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY');

    if (!YOUTUBE_API_KEY) {
      console.error('YouTube API key not configured');
      return new Response(
        JSON.stringify({ error: 'Service nicht verfügbar' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }

    console.log('Fetching videos for channel:', channelId, 'pageToken:', pageToken);

    // Get uploads playlist for the channel
    const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${YOUTUBE_API_KEY}`;
    const channelResp = await fetch(channelUrl);
    if (!channelResp.ok) {
      const errorData = await channelResp.text();
      console.error('YouTube API (channels) error:', errorData);
      return new Response(
        JSON.stringify({ error: 'Kanal konnte nicht geladen werden' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404 
        }
      );
    }
    const channelData = await channelResp.json();
    const uploadsPlaylistId = channelData?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) {
      console.error('Uploads playlist not found for channel:', channelId);
      return new Response(
        JSON.stringify({ error: 'Videos konnten nicht geladen werden' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404 
        }
      );
    }

    // Fetch playlist items (this returns ALL uploads over multiple pages)
    let playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?key=${YOUTUBE_API_KEY}&playlistId=${uploadsPlaylistId}&part=contentDetails,snippet&maxResults=50`;
    if (pageToken) {
      playlistUrl += `&pageToken=${pageToken}`;
    }

    const playlistResp = await fetch(playlistUrl);
    if (!playlistResp.ok) {
      const errorData = await playlistResp.text();
      console.error('YouTube API (playlistItems) error:', errorData);
      return new Response(
        JSON.stringify({ error: 'Videos konnten nicht geladen werden' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }

    const playlistData = await playlistResp.json();
    const nextPageToken = playlistData.nextPageToken || null;
    console.log(`Playlist items: ${playlistData.items?.length || 0}, nextPageToken: ${nextPageToken}`);

    // Extract video IDs
    const ids = (playlistData.items || [])
      .map((item: any) => item?.contentDetails?.videoId)
      .filter(Boolean);

    if (!ids.length) {
      console.log('No video IDs found in playlist page, returning empty result');
      return new Response(
        JSON.stringify({ videos: [], nextPageToken }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`Getting details for ${ids.length} videos`);
    const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?key=${YOUTUBE_API_KEY}&id=${ids.join(',')}&part=contentDetails,snippet,statistics`;
    const detailsResponse = await fetch(detailsUrl);
    const detailsData = await detailsResponse.json();

    console.log(`Got details for ${detailsData.items?.length || 0} videos`);

    // Filter: nur 16:9 (keine vertikalen Shorts), keine Längenbeschränkung
    const isLandscape = (thumb?: { width?: number; height?: number }) => {
      if (!thumb?.width || !thumb?.height) return true; // wenn unbekannt, behalten
      const ratio = thumb.width / thumb.height;
      return ratio >= 1.6; // enger auf 16:9 ausrichten
    };

    const pickThumb = (thumbs: any) =>
      thumbs?.maxres || thumbs?.standard || thumbs?.high || thumbs?.medium || thumbs?.default;

    const filteredVideos = (detailsData.items || []).filter((video: any) => {
      const thumbs = video?.snippet?.thumbnails;
      const t = pickThumb(thumbs);
      return isLandscape(t);
    });

    console.log(`Filtered ${filteredVideos.length} landscape videos from ${detailsData.items?.length || 0} total videos`);

    return new Response(
      JSON.stringify({ videos: filteredVideos, nextPageToken }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in youtube-videos function:', error);
    return new Response(
      JSON.stringify({ error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
