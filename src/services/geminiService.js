// src/services/geminiService.js
// Gemini AI integration for automatic card recognition from photos

export function getApiKey() {
  let key = localStorage.getItem("gemini_api_key");
  console.log("Key aus localStorage:", key);

  if (!key) {
    key = import.meta.env.VITE_GEMINI_API_KEY;
    console.log("Key aus Environment Variable:", key);
    if (key) localStorage.setItem("gemini_api_key", key);
  }
  return key;
}
  
  export async function recognizeAllBoards(images) {
    const apiKey = getApiKey();
    console.log("=== [DEBUG] recognizeAllBoards gestartet ===");
    console.log("API Key vorhanden:", !!apiKey);
  
    if (!apiKey) {
      console.warn("Kein API-Key gefunden!");
      return null;
    }
  

    const valid = images.filter(Boolean);
    const n = valid.length;       
    if (n === 0) return null;
    const prompt = `You are an expert at reading playing cards from photos of Open Face Chinese (OFC) Poker boards.

    You will receive ${n} image(s). Each image contains exactly one complete OFC board with three rows:
    - Top row: exactly 3 cards
    - Middle row: exactly 5 cards  
    - Bottom row: exactly 5 cards
    
    Instructions:
    - Analyze each card very carefully.
    - Pay special attention to distinguishing 6 and 9 (the 6 opens upwards, the 9 opens downwards).
    - Pay close attention to suit colors: ♠ and ♣ are black, ♥ and ♦ are red.
    - If a card is unclear, partially covered, or you are uncertain, output "" for that card.
    - Respond ONLY with a JSON array. No explanations, no extra text.
    
    Output format example:
    [{"top":["Ah","Kd","7s"],"middle":["Ts","9h","8d","7c","6s"],"bottom":["As","Ad","Ac","Kh","Ks"]}]`;
  
    const parts = [{ text: prompt }];
    for (const img of valid) {
      parts.push({
        inline_data: { mime_type: img.mimeType, data: img.base64 },
      });
    }
  
    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.1,
              topP: 0.8
            },
          }),
        }
      );
  
      const data = await resp.json();
      // === WICHTIGE DEBUG-AUSGABEN ===
      console.log("=== [DEBUG] Rohe API-Antwort ===");
      console.log(data);

      if (data.error) {
        console.error("Gemini API Fehler:", data.error);
        alert(`Gemini Fehler: ${data.error.message}`);
        return null;
      }
  
      let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      console.log("=== [DEBUG] Roher Text von Gemini ===");
      console.log(text);

      text = text.replace(/```json/gi, "").replace(/```/gi, "").trim();

      console.log("=== [DEBUG] Bereinigter Text ===");
      console.log(text);

      const parsed = JSON.parse(text);
      console.log("=== [DEBUG] Finales geparstes Ergebnis ===");
      console.log(parsed);

      return Array.isArray(parsed) ? parsed : [parsed];

    } catch (err) {
      console.error("Fehler beim API-Aufruf:", err);
      alert(`Fehler: ${err.message}`);
      return null;
    }
  }
  
  export function normalizeCard(c) {
    if (!c || c === "??" || c === "") return "";
    const s = String(c).trim();
    if (s.length < 2) return "";
    const sm = {
      s: "♠", h: "♥", d: "♦", c: "♣",
      S: "♠", H: "♥", D: "♦", C: "♣",
    };
    let rank = s.slice(0, -1).toUpperCase();
    if (rank === "10") rank = "T";
    return rank + (sm[s.slice(-1)] || s.slice(-1));
  }
  