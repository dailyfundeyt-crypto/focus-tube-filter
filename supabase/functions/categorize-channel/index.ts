import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { channelName } = await req.json();
    
    if (!channelName) {
      return new Response(
        JSON.stringify({ error: 'Channel name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log(`Categorizing channel: ${channelName}`);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Du bist ein YouTube-Kanal-Kategorisierungs-Experte. Analysiere den Kanalnamen und ordne ihn einer der folgenden Kategorien zu:
- Gaming
- Technologie
- Bildung
- Unterhaltung
- Musik
- Sport
- Nachrichten
- Lifestyle
- Wissenschaft
- Kunst & Kreativ
- Kochen & Essen
- Reisen
- Gesundheit & Fitness
- Business & Finanzen
- Sonstiges

Antworte NUR mit dem Kategorienamen, nichts anderes.`
          },
          {
            role: 'user',
            content: `Kategorisiere diesen YouTube-Kanal: "${channelName}"`
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Zu viele Anfragen. Bitte versuche es später erneut.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Guthaben erforderlich. Bitte füge Guthaben zu deinem Lovable AI Workspace hinzu.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error('AI Gateway error');
    }

    const data = await response.json();
    const category = data.choices[0].message.content.trim();

    console.log(`Channel "${channelName}" categorized as: ${category}`);

    return new Response(
      JSON.stringify({ category }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in categorize-channel function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
