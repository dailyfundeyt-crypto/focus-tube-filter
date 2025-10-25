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
    const { channelInput } = await req.json();
    const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY');

    if (!YOUTUBE_API_KEY) {
      throw new Error('YouTube API key not configured');
    }

    if (!channelInput) {
      throw new Error('Channel input is required');
    }

    console.log('Fetching channel info for:', channelInput);

    let channelId = channelInput;
    
    // If input looks like a URL, extract channel ID or username
    if (channelInput.includes('youtube.com') || channelInput.includes('youtu.be')) {
      const urlMatch = channelInput.match(/(?:channel\/|@|user\/)([^/?]+)/);
      if (urlMatch) {
        channelId = urlMatch[1];
      }
    }

    // Try to get channel by ID first
    let url = `https://www.googleapis.com/youtube/v3/channels?key=${YOUTUBE_API_KEY}&id=${channelId}&part=snippet`;
    let response = await fetch(url);
    let data = await response.json();

    // If no results and input starts with @, try searching by username
    if (!data.items || data.items.length === 0) {
      if (channelId.startsWith('@')) {
        channelId = channelId.substring(1);
      }
      url = `https://www.googleapis.com/youtube/v3/channels?key=${YOUTUBE_API_KEY}&forHandle=${channelId}&part=snippet`;
      response = await fetch(url);
      data = await response.json();
    }

    // If still no results, try searching by username without @ 
    if (!data.items || data.items.length === 0) {
      url = `https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_API_KEY}&q=${encodeURIComponent(channelId)}&type=channel&part=snippet&maxResults=1`;
      response = await fetch(url);
      data = await response.json();
      
      if (data.items && data.items.length > 0) {
        const searchChannelId = data.items[0].id.channelId;
        url = `https://www.googleapis.com/youtube/v3/channels?key=${YOUTUBE_API_KEY}&id=${searchChannelId}&part=snippet`;
        response = await fetch(url);
        data = await response.json();
      }
    }

    if (!response.ok || !data.items || data.items.length === 0) {
      throw new Error('Channel not found');
    }

    const channel = data.items[0];
    
    return new Response(
      JSON.stringify({
        channelId: channel.id,
        channelName: channel.snippet.title,
        channelThumbnail: channel.snippet.thumbnails.default.url,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in youtube-channel-info function:', error);
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
