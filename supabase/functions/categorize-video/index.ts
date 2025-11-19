import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { channelName } = await req.json();
    console.log("Categorizing channel:", channelName);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI service not available", category: "Allgemein" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "Du bist ein Experte für die Kategorisierung von Lerninhalten. Antworte NUR mit der Kategorie, nichts anderes."
          },
          {
            role: "user",
            content: `Kategorisiere diesen YouTube-Kanal in GENAU EINE der folgenden Skill-Kategorien:

Programmierung, Web Development, Data Science, Künstliche Intelligenz, Design, Marketing, Business, Sprachen, Musik, Sport, Gesundheit, Kochen, Fotografie, Video Production, 3D Modeling, Game Development, Finanzen, Persönlichkeitsentwicklung, Wissenschaft, Mathematik, Allgemein

Kanal: ${channelName}

Antworte NUR mit der Kategorie (z.B. "Programmierung"), nichts anderes.`
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI request failed", category: "Allgemein" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();
    const category = data.choices?.[0]?.message?.content?.trim() || "Allgemein";
    console.log("Categorized channel as:", category);

    return new Response(
      JSON.stringify({ category }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in categorize-channel:", error);
    return new Response(
      JSON.stringify({ error: "Internal error", category: "Allgemein" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});