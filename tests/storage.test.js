import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/storage.js';
import { emptyStats } from '../js/stats.js';

const fakeStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const deny = () => { throw new Error('denied'); };
const throwing = { getItem: deny, setItem: deny, removeItem: deny };

test('defaults when empty', () => {
  const st = createStore(fakeStorage());
  assert.deepEqual(st.loadStats(), emptyStats());
  assert.equal(st.loadDaily(), null);
  assert.deepEqual(st.loadSettings(), { theme: 'flat', tutorialSeen: false, sound: true, textures: true });
});
test('round trip', () => {
  const st = createStore(fakeStorage());
  const daily = { date: '2026-10-24', game: { n: 6, marks: ['unknown'] } };
  st.saveDaily(daily); st.saveSettings({ theme: 'pixel', tutorialSeen: true, sound: false, textures: false });
  assert.deepEqual(st.loadDaily(), daily); assert.deepEqual(st.loadSettings(), { theme: 'pixel', tutorialSeen: true, sound: false, textures: false });
});
test('corrupted data falls back to defaults', () => {
  const fs = fakeStorage();
  fs.setItem('mws.stats', '{oops'); fs.setItem('mws.daily', '"nope"'); fs.setItem('mws.settings', '{"theme":"neon"}');
  const st = createStore(fs);
  assert.deepEqual(st.loadStats(), emptyStats()); assert.equal(st.loadDaily(), null);
  assert.deepEqual(st.loadSettings(), { theme: 'flat', tutorialSeen: false, sound: true, textures: true });
});
test('sound is on unless saved as off', () => {
  const fs = fakeStorage();
  fs.setItem('mws.settings', '{"theme":"pixel","sound":"no"}');
  assert.equal(createStore(fs).loadSettings().sound, true);
  fs.setItem('mws.settings', '{"sound":false}');
  assert.equal(createStore(fs).loadSettings().sound, false);
});
test('partial stats are filled in from defaults', () => {
  const fs = fakeStorage();
  fs.setItem('mws.stats', '{"daily":{"played":3}}');
  const s = createStore(fs).loadStats();
  assert.equal(s.daily.played, 3); assert.equal(s.daily.streak, 0); assert.deepEqual(s.arena, emptyStats().arena);
});
test('storage that throws never throws and keeps working in memory', () => {
  const st = createStore(throwing);
  st.saveSettings({ theme: 'candy', tutorialSeen: true });
  assert.equal(st.loadSettings().theme, 'candy');
});
test('createStore() with no argument works without localStorage', () => {
  const st = createStore();
  st.saveStats(emptyStats());
  assert.deepEqual(st.loadStats(), emptyStats());
});
test('reads see the latest save even when setItem fails but getItem works', () => {
  const fs = fakeStorage();
  fs.setItem('mws.settings', '{"theme":"flat","tutorialSeen":false}');
  const st = createStore({ ...fs, setItem: deny });
  st.saveSettings({ theme: 'pixel', tutorialSeen: true, sound: true, textures: true });
  assert.deepEqual(st.loadSettings(), { theme: 'pixel', tutorialSeen: true, sound: true, textures: true });
});
test('saving an unserializable value does not throw', () => {
  const st = createStore(fakeStorage());
  const circ = {}; circ.self = circ;
  assert.doesNotThrow(() => st.saveStats(circ));
  assert.doesNotThrow(() => st.saveStats({ n: 1n }));
  assert.deepEqual(st.loadStats(), emptyStats());
});
test('two stores on one storage see each other and do not clobber', () => {
  const fs = fakeStorage();
  const a = createStore(fs), b = createStore(fs);
  const daily = { date: '2026-10-24', game: { n: 6, marks: ['safe'] } };
  a.saveDaily({ date: '2026-10-23', game: { n: 6, marks: ['unknown'] } });
  b.saveDaily(daily);
  assert.deepEqual(a.loadDaily(), daily); // B's save is visible to A after A wrote the same key
  const stats = { ...emptyStats(), arena: { ...emptyStats().arena, played: 1 } };
  a.saveStats(stats);
  assert.deepEqual(b.loadDaily(), daily); // A's save of another key leaves B's data alone
  assert.deepEqual(a.loadStats(), stats);
});
