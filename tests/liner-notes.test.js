import test from 'node:test';
import assert from 'node:assert/strict';
import {calendar, sonify} from '../dist/core.js';
import {writeLinerNotes} from '../dist/liner-notes.js';
const settings = {interpretation:'annual', melody:'mood', rhythm:'steps', tension:'rhr', target:8, sensitivity:1, palette:'ambient', duration:60};
const compose = rows => writeLinerNotes(sonify(rows, settings), settings);
const makeDays = (count, values) => calendar(2025).slice(0,count).map((day,index)=>({...day,...values(index)}));

test('no measurements means no liner notes; inputs are not mutated',()=>{
  assert.equal(compose(calendar(2025)),null);
  const rows=makeDays(30,()=>({steps:6000,sleep:8}));
  const original=JSON.stringify(rows);
  const first=compose(rows);
  assert.equal(JSON.stringify(rows),original);
  assert.deepEqual(compose(rows),first);
});

test('sparse records do not manufacture data trends, mood, or bad days',()=>{
  const rows=calendar(2025); rows[0].rhr=60; rows[364].rhr=85;
  const notes=compose(rows);
  assert.equal(notes.patterns.length,0);
  assert.equal(notes.covered,2);
  assert.equal(notes.missing,363);
  assert.match(notes.music,/363 unrecorded days play quiet neutral notes/);
  assert.match(notes.limits.join(' '),/No mood entries/);
  assert.match(notes.music,/neutral pitch/);
});

test('rising RHR is described with observed evidence, without claiming illness or fitness change',()=>{
  const notes=compose(makeDays(30,i=>({rhr:i<10?60:i>=20?68:64})));
  const rhr=notes.patterns.find(p=>p.metric==='rhr');
  assert.match(rhr.text,/higher/);
  assert.match(rhr.text,/60 → 68 bpm/);
  assert.match(rhr.text,/cannot explain/);
  assert.equal(notes.evidence.find(e=>e.metric==='rhr').count,30);
});

test('an extreme single reading does not turn a steady period into a trend',()=>{
  const notes=compose(makeDays(30,i=>({rhr:i===29?200:60})));
  assert.doesNotMatch(notes.patterns[0].text,/higher than the opening/);
});

test('trend comparisons require adequate coverage in both calendar thirds',()=>{
  const notes=compose(makeDays(30,i=>i<5?{}:{rhr:i<20?60:68}));
  const rhr=notes.patterns.find(p=>p.metric==='rhr');
  assert.ok(rhr);
  assert.doesNotMatch(rhr.text,/closing third/);
});

test('more sleep never creates an unlimited benefit; zero is distinct from missing',()=>{
  const notes=compose(makeDays(30,i=>({sleep:i===0?0:9,steps:0})));
  const sleep=notes.patterns.find(p=>p.metric==='sleep');
  assert.match(sleep.text,/1 of 30/);
  assert.match(sleep.text,/chosen 8-hour target/);
  assert.match(sleep.text,/extra hours do not add an unlimited reward/);
  assert.equal(notes.evidence.find(e=>e.metric==='steps').count,30);
  assert.match(notes.patterns.find(p=>p.metric==='steps').text,/0 steps/);
});

test('HRV direction is descriptive; high values are not declared a better outcome',()=>{
  const notes=compose(makeDays(30,i=>({hrv:i<10?30:i>=20?60:45})));
  const hrv=notes.patterns.find(p=>p.metric==='hrv');
  assert.match(hrv.text,/higher/);
  assert.match(hrv.text,/not automatically a better outcome/);
});

test('notes follow the selected mappings and month, not an unseen full year',()=>{
  const month=makeDays(31,()=>({activity:45,sleep:8,mood:4}));
  const mapped={...settings,rhythm:'activity',melody:'sleep',tension:'none',palette:'glass',duration:90};
  const notes=writeLinerNotes(sonify(month,mapped),mapped);
  assert.equal(notes.total,31);
  assert.match(notes.music,/Daylight/);
  assert.match(notes.music,/90-second/);
  assert.match(notes.music,/sleep relative to your chosen target/);
  assert.doesNotMatch(notes.music,/harmonic friction/);
  assert.ok(notes.patterns.find(p=>p.metric==='activity'));
  assert.ok(!notes.patterns.find(p=>p.metric==='steps'));
});
