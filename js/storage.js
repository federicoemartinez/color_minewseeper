import { emptyStats } from './stats.js';

const THEMES = ['flat', 'pixel', 'candy'];
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function defaultStorage() {
  try {
    const ls = globalThis.localStorage;
    ls.setItem('mws.probe', '1');
    ls.removeItem('mws.probe');
    return ls;
  } catch {
    return null;
  }
}

export function createStore(storage = defaultStorage()) {
  const mem = new Map(); // fallback, also holds values a failing storage refused
  const read = (key) => {
    let raw = null;
    try { raw = storage?.getItem(key) ?? null; } catch { /* use memory */ }
    raw = raw ?? mem.get(key) ?? null;
    try { return raw === null ? null : JSON.parse(raw); } catch { return null; }
  };
  const write = (key, value) => {
    const raw = JSON.stringify(value);
    mem.set(key, raw);
    try { storage?.setItem(key, raw); } catch { /* memory copy stays */ }
  };

  return {
    loadStats() {
      const base = emptyStats();
      const s = read('mws.stats');
      if (!isObj(s)) return base;
      return {
        daily: { ...base.daily, ...(isObj(s.daily) ? s.daily : {}) },
        arena: { ...base.arena, ...(isObj(s.arena) ? s.arena : {}) },
      };
    },
    saveStats: (s) => write('mws.stats', s),
    loadDaily() {
      const d = read('mws.daily');
      return isObj(d) && /^\d{4}-\d{2}-\d{2}$/.test(d.date) && isObj(d.game) && Array.isArray(d.game.marks) ? d : null;
    },
    saveDaily: (d) => write('mws.daily', d),
    loadSettings() {
      const s = read('mws.settings');
      return {
        theme: isObj(s) && THEMES.includes(s.theme) ? s.theme : 'flat',
        tutorialSeen: isObj(s) && s.tutorialSeen === true,
      };
    },
    saveSettings: (s) => write('mws.settings', s),
  };
}
