import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoTitle, channelName } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    console.log("Categorizing video:", videoTitle, "from channel:", channelName);

    // Call Lovable AI to categorize the video
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Du bist ein Experte darin, YouTube-Videos in Skill-Kategorien einzuordnen. 
Analysiere den Video-Titel und Kanal-Namen und gib EINE einzige, präzise Skill-Kategorie zurück.
Die Kategorie sollte kurz sein (1-3 Wörter) und das Hauptthema/Skill beschreiben.
Beispiele: "Programmierung", "Fotografie", "Kochen", "Fitness", "Design", "Sprachen", "Musik"
Antworte NUR mit der Kategorie, nichts anderes.`,
          },
          {
            role: "user",
            content: `Video-Titel: ${videoTitle}\nKanal: ${channelName}`,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const category = aiData.choices?.[0]?.message?.content?.trim() || "Allgemein";

    console.log("Categorized as:", category);

    return new Response(JSON.stringify({ category }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in categorize-video function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage, category: "Allgemein" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});