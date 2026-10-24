import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOUNDS, playSound, unlockAudio } from '../js/sound.js';

test('every theme has a sound for every moment', () => {
  const moments = ['tap', 'flag', 'wrong', 'boom', 'won', 'flawless'];
  for (const t of ['flat', 'pixel', 'candy']) assert.deepEqual(Object.keys(SOUNDS[t]).sort(), [...moments].sort(), t);
});
test('without Web Audio, unlocking and playing do nothing and never throw', () => {
  assert.doesNotThrow(() => { unlockAudio(); playSound('flat', 'boom'); });
});
