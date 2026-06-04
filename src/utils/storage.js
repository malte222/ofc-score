// src/utils/storage.js
// LocalStorage persistence helpers

export function loadData() {
    try {
      return {
        players: JSON.parse(localStorage.getItem("ofc:players") || "[]"),
        sessions: JSON.parse(localStorage.getItem("ofc:sessions") || "[]"),
      };
    } catch {
      return { players: [], sessions: [] };
    }
  }
  
  export function saveData(p, s) {
    try {
      localStorage.setItem("ofc:players", JSON.stringify(p));
      localStorage.setItem("ofc:sessions", JSON.stringify(s));
    } catch (e) {
      // Silently fail – storage might be full or disabled
    }
  }
  