// Speichert Daten nur lokal im Browser des Geräts (localStorage).
// Kein Server, kein Konto, keine Übertragung an Dritte.

export function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error(`Konnte "${key}" nicht laden:`, e);
    return fallback;
  }
}

export function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Konnte "${key}" nicht speichern:`, e);
  }
}
