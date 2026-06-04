// src/services/geminiService.js
// Gemini AI integration for automatic card recognition from photos

export function getApiKey() {
    let key = localStorage.getItem("gemini_api_key");
    if (!key) {
      key = prompt("Bitte gib deinen Google Gemini API-Key ein:");
      if (key) localStorage.setItem("gemini_api_key", key);
    }
    return key;
  }
  
  export async function recognizeAllBoards(images) {
    const apiKey = getApiKey();
    if (!apiKey) return null;
  
    const valid = images.filter(Boolean);
    const n = valid.length;
    if (n === 0) return null;
  
    const prompt = `Du bist ein Experte für das Erkennen von Spielkarten auf OFC Poker Board Fotos.
  Du erhältst ${n} Bild(er). Jedes zeigt genau ein OFC-Board mit 3 Reihen (Top:3, Middle:5, Bottom:5 Karten).
  Antworte NUR mit einem JSON-Array mit ${n} Objekten. Kein anderer Text.
  Format: Wert+Farbe (A/K/Q/J/T/9-2 + s/h/d/c). "10" → "T". Nicht erkennbar → "".
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
            generationConfig: { responseMimeType: "application/json" },
          }),
        }
      );
  
      const data = await resp.json();
      if (data.error) {
        alert(`Gemini Fehler: ${data.error.message}`);
        return null;
      }
  
      let text = data.candidates[0].content.parts[0].text
        .replace(/```json/gi, "")
        .replace(/```/gi, "")
        .trim();
  
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (err) {
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
  