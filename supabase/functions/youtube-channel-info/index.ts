import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const channelInputSchema = z.object({
  channelInput: z.string().trim().min(1, "Channel input cannot be empty").max(500, "Channel input too long"),
});

// Extract playlist ID from URL
function extractPlaylistId(input: string): string | null {
  // Match ?list=PLxxx or &list=PLxxx
  const match = input.match(/[?&]list=([A-Za-z0-9_-]+)/);
  if (match) return match[1];
  // Also accept raw playlist IDs starting with PL
  if (/^PL[A-Za-z0-9_-]+$/.test(input)) return input;
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const validationResult = channelInputSchema.safeParse(body);
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: 'Ungültige Eingabe' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { channelInput } = validationResult.data;
    const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY');

    if (!YOUTUBE_API_KEY) {
      console.error('YouTube API key not configured');
      return new Response(
        JSON.stringify({ error: 'Service nicht verfügbar' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Check if input is a playlist URL/ID
    const playlistId = extractPlaylistId(channelInput);
    
    if (playlistId) {
      console.log('Detected playlist input, fetching playlist info:', playlistId);
      
      const playlistUrl = `https://www.googleapis.com/youtube/v3/playlists?key=${YOUTUBE_API_KEY}&id=${playlistId}&part=snippet`;
      const playlistResp = await fetch(playlistUrl);
      const playlistData = await playlistResp.json();
      
      if (!playlistResp.ok || !playlistData.items || playlistData.items.length === 0) {
        console.error('Playlist not found:', playlistId);
        return new Response(
          JSON.stringify({ error: 'Playlist nicht gefunden' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }
      
      const playlist = playlistData.items[0];
      const thumbnail = playlist.snippet.thumbnails?.default?.url || 
                         playlist.snippet.thumbnails?.medium?.url || null;
      
      return new Response(
        JSON.stringify({
          channelId: playlistId, // Use playlist ID as the "channel" ID
          channelName: `📋 ${playlist.snippet.title}`,
          channelThumbnail: thumbnail,
          isPlaylist: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Regular channel logic
    console.log('Fetching channel info for:', channelInput);

    let channelId = channelInput;
    
    if (channelInput.includes('youtube.com') || channelInput.includes('youtu.be')) {
      const urlMatch = channelInput.match(/(?:channel\/|@|user\/)([^/?]+)/);
      if (urlMatch) {
        channelId = urlMatch[1];
      }
    }

    let url = `https://www.googleapis.com/youtube/v3/channels?key=${YOUTUBE_API_KEY}&id=${channelId}&part=snippet`;
    let response = await fetch(url);
    let data = await response.json();

    if (!data.items || data.items.length === 0) {
      if (channelId.startsWith('@')) {
        channelId = channelId.substring(1);
      }
      url = `https://www.googleapis.com/youtube/v3/channels?key=${YOUTUBE_API_KEY}&forHandle=${channelId}&part=snippet`;
      response = await fetch(url);
      data = await response.json();
    }

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
      console.error('Channel not found for input:', channelInput);
      return new Response(
        JSON.stringify({ error: 'Kanal nicht gefunden' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    const channel = data.items[0];
    
    return new Response(
      JSON.stringify({
        channelId: channel.id,
        channelName: channel.snippet.title,
        channelThumbnail: channel.snippet.thumbnails.default.url,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error in youtube-channel-info function:', error);
    return new Response(
      JSON.stringify({ error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
