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

    // Filter out Shorts by checking video definition and aspect ratio
    // Shorts are typically vertical (9:16) while normal videos are horizontal (16:9)
    const nonShortVideos = (detailsData.items || []).filter((video: any) => {
      const contentDetails = video?.contentDetails;
      if (!contentDetails) return false;
      
      // Shorts have specific characteristics:
      // 1. They are in 'rectangular' projection (like regular videos)
      // 2. But we can filter by duration - YouTube Shorts are max 60 seconds
      // However, vertical videos can be longer, so we check snippet dimensions if available
      const duration = contentDetails.duration || '';
      const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (!match) return true;
      
      const hours = parseInt(match[1] || '0');
      const minutes = parseInt(match[2] || '0');
      const seconds = parseInt(match[3] || '0');
      const totalSeconds = hours * 3600 + minutes * 60 + seconds;
      
      // YouTube Shorts are defined as videos under 60 seconds in vertical format
      // We'll be conservative and filter videos under 61 seconds as they're likely Shorts
      return totalSeconds > 60;
    });

    console.log(`Filtered ${nonShortVideos.length} non-short videos from ${detailsData.items?.length || 0} total videos`);

    return new Response(
      JSON.stringify({ videos: nonShortVideos, nextPageToken }),
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
