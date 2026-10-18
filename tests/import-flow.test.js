import test from 'node:test';
import assert from 'node:assert/strict';
import {availableSignals,defaultMusicalMappings,preferredYear} from '../dist/import-flow.js';
import {sonify} from '../dist/core.js';
import {writeLinerNotes} from '../dist/liner-notes.js';

test('imports without mood select an available melody signal',()=>{
  assert.equal(defaultMusicalMappings([{date:'2025-01-01',hrv:40,sleep:8}]).melody,'hrv');
  assert.equal(defaultMusicalMappings([{date:'2025-01-01',sleep:8}]).melody,'sleep');
  assert.equal(defaultMusicalMappings([{date:'2025-01-01',mood:3,hrv:40}]).melody,'mood');
});
test('an activity-only file remains playable with explicit neutral melody and no tension',()=>{
  const rows=[{date:'2025-01-01',activity:30},{date:'2025-01-02',activity:60}];
  const mapped=defaultMusicalMappings(rows);
  assert.deepEqual(mapped,{melody:'none',rhythm:'activity',tension:'none'});
  const settings={...mapped,interpretation:'annual',target:8,sensitivity:1,palette:'ambient',duration:60};
  const score=sonify(rows,settings);
  assert.ok(score.every(day=>day.color===null&&Number.isFinite(day.movement)&&day.tension===0));
  assert.ok(writeLinerNotes(score,settings));
});
test('resting HR alone uses harmonic tension with neutral melody and no added rhythm',()=>{
  const rows=[{date:'2025-01-01',rhr:60},{date:'2025-01-02',rhr:68}];
  const settings={...defaultMusicalMappings(rows),interpretation:'annual',target:8,sensitivity:1};
  const score=sonify(rows,settings);
  assert.equal(settings.tension,'rhr');
  assert.ok(score.every(day=>day.color===null&&day.movement===null));
  assert.ok(score[1].tension>score[0].tension);
});
test('zero readings count as available; blank and absent fields do not',()=>{
  assert.deepEqual(availableSignals([{date:'2025-01-01',steps:0,sleep:0,mood:null}]),['sleep','steps']);
});
test('initial year favors measurement coverage over a few newer dates',()=>{
  assert.equal(preferredYear([{date:'2024-01-01',steps:1},{date:'2024-01-02',steps:2},{date:'2025-01-01',steps:3},{date:'2026-01-01'}]),'2024');
  assert.equal(preferredYear([{date:'2024-01-01',steps:1},{date:'2025-01-01',steps:1}]),'2025');
  assert.equal(preferredYear([]),null);
});
