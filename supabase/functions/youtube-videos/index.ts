import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { channelId, pageToken = null, order = "date" } = await req.json();
    const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY');

    if (!YOUTUBE_API_KEY) {
      throw new Error('YouTube API key not configured');
    }

    if (!channelId) {
      throw new Error('Channel ID is required');
    }

    console.log('Fetching videos for channel:', channelId);

    // Fetch videos from the channel with pagination support
    let videosUrl = `https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_API_KEY}&channelId=${channelId}&part=snippet&order=${order}&maxResults=50&type=video`;
    if (pageToken) {
      videosUrl += `&pageToken=${pageToken}`;
    }
    
    const videosResponse = await fetch(videosUrl);
    
    if (!videosResponse.ok) {
      const errorData = await videosResponse.text();
      console.error('YouTube API error:', errorData);
      throw new Error(`YouTube API error: ${videosResponse.status}`);
    }

    const videosData = await videosResponse.json();
    const nextPageToken = videosData.nextPageToken || null;

    // Get video details to filter out shorts via duration
    const ids = (videosData.items || [])
      .map((item: any) => item?.id?.videoId)
      .filter(Boolean);

    if (!ids.length) {
      return new Response(
        JSON.stringify({ videos: [], nextPageToken }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?key=${YOUTUBE_API_KEY}&id=${ids.join(',')}&part=contentDetails,snippet,statistics`;
    const detailsResponse = await fetch(detailsUrl);
    const detailsData = await detailsResponse.json();

    // Filter: nur 16:9 (keine vertikalen Shorts), keine Längenbeschränkung
    const isLandscape = (thumb?: { width?: number; height?: number }) => {
      if (!thumb?.width || !thumb?.height) return true; // wenn unbekannt, behalten
      const ratio = thumb.width / thumb.height;
      return ratio >= 1.3; // grobe Schwelle für Landscape (16:9 ≈ 1.78)
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
