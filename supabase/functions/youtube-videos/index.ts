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
    const { channelId } = await req.json();
    const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY');

    if (!YOUTUBE_API_KEY) {
      throw new Error('YouTube API key not configured');
    }

    if (!channelId) {
      throw new Error('Channel ID is required');
    }

    console.log('Fetching videos for channel:', channelId);

    // Fetch videos from the channel (maxResults=50 is the API limit per request)
    const videosUrl = `https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_API_KEY}&channelId=${channelId}&part=snippet&order=date&maxResults=50&type=video`;
    
    const videosResponse = await fetch(videosUrl);
    
    if (!videosResponse.ok) {
      const errorData = await videosResponse.text();
      console.error('YouTube API error:', errorData);
      throw new Error(`YouTube API error: ${videosResponse.status}`);
    }

    const videosData = await videosResponse.json();

    // Get video details to filter out shorts (videos < 60 seconds)
    const videoIds = videosData.items.map((item: any) => item.id.videoId).join(',');
    
    const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?key=${YOUTUBE_API_KEY}&id=${videoIds}&part=contentDetails,snippet,statistics`;
    
    const detailsResponse = await fetch(detailsUrl);
    const detailsData = await detailsResponse.json();

    // Filter out shorts (videos shorter than 60 seconds)
    const longVideos = detailsData.items.filter((video: any) => {
      const duration = video.contentDetails.duration;
      // Parse ISO 8601 duration format (e.g., PT1M30S = 1 minute 30 seconds)
      const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      const hours = parseInt(match[1] || '0');
      const minutes = parseInt(match[2] || '0');
      const seconds = parseInt(match[3] || '0');
      const totalSeconds = hours * 3600 + minutes * 60 + seconds;
      
      // Only include videos longer than 60 seconds
      return totalSeconds > 60;
    });

    console.log(`Filtered ${longVideos.length} long videos from ${detailsData.items.length} total videos`);

    return new Response(
      JSON.stringify({ videos: longVideos }),
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
