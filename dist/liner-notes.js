import {METRICS, median} from './core.js';

const NOTES_MIN_READINGS = 7;
const NOTES_MIN_COVERAGE = .5;
const notesMean = values => values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : null;
const notesValues = (days, metric) => days.map(day => day[metric]).filter(Number.isFinite);
const notesNumber = (number, digits = 0) => number.toLocaleString('en-US', {maximumFractionDigits: digits});

// Compare equal calendar windows, not just the first/last available records.
// These thresholds suppress trivial changes; they are not clinical thresholds.
function notesTrend(days, metric, minimumChange) {
  const width = Math.floor(days.length / 3);
  if (width < NOTES_MIN_READINGS) return null;
  const opening = notesValues(days.slice(0, width), metric);
  const closing = notesValues(days.slice(-width), metric);
  const required = Math.max(NOTES_MIN_READINGS, Math.ceil(width * NOTES_MIN_COVERAGE));
  if (opening.length < required || closing.length < required) return null;
  const first = median(opening), last = median(closing);
  const delta = last - first;
  if (Math.abs(delta) < minimumChange(first)) return null;
  return {first, last, direction: delta > 0 ? 'higher' : 'lower', firstCount: opening.length, lastCount: closing.length};
}

function notesMusicalArc(days, key, minimumChange) {
  const width = Math.floor(days.length / 3);
  if (!width) return null;
  const opening = notesValues(days.slice(0, width), key);
  const closing = notesValues(days.slice(-width), key);
  if (opening.length < Math.max(1, Math.ceil(width * .5)) || closing.length < Math.max(1, Math.ceil(width * .5))) return null;
  const difference = notesMean(closing) - notesMean(opening);
  return Math.abs(difference) >= minimumChange ? difference : null;
}

export function writeLinerNotes(days, settings) {
  const total = days.length;
  const covered = days.filter(day => METRICS.some(key => Number.isFinite(day[key]))).length;
  if (!covered) return null;
  const missing = total - covered;
  const palette = {
    ambient: {name: 'Soft focus',sound: 'soft sine tones'},
    glass: {name: 'Daylight',sound: 'bright upper overtones'},
    warm: {name: 'Afterglow',sound: 'warm triangle tones'}
  }[settings.palette] || {name: 'Soft focus', sound: 'soft sine tones'};
  const movement = notesValues(days, 'movement');
  const motion = notesMean(movement);
  // The audio engine adds one semitone neighbor only when tension exceeds .12.
  const tense = days.filter(day => day.hasData && Number.isFinite(day.tension) && day.tension > .12).length;
  const density = motion === null ? 'a restrained' : motion >= .65 ? 'a lively' : motion >= .3 ? 'a measured' : 'a spacious';
  const title = motion !== null && motion >= .65 ? 'A pulse that keeps moving.' : motion !== null && motion < .3 ? 'Room between the notes.' : 'Small shifts, a distinct rhythm.';
  const music = [`${palette.name} gives this ${settings.duration}-second piece ${palette.sound} and ${density} pulse. Each calendar day becomes one main note.`];
  const melodyCount = notesValues(days, 'color').length;
  if (!melodyCount) {
    music.push('The selected melody input is unavailable, so the melody uses a neutral pitch rather than inventing an emotional story.');
  } else {
    const labels = {mood:'recorded mood',hrv:'HRV relative to its reference',sleep:'sleep relative to your chosen target'};
    const low = Math.min(...notesValues(days, 'color')), high = Math.max(...notesValues(days, 'color'));
    music.push(`The melody follows ${labels[settings.melody] || 'the selected input'}, with ${high - low >= .4 ? 'noticeable changes in register' : 'a relatively narrow range'}.`);
  }
  const arc = notesMusicalArc(days, 'movement', .15);
  if (arc !== null) music.push(arc > 0 ? 'Rhythmic activity gathers toward the closing third.' : 'The closing third leaves more space between rhythmic pulses than the opening.');
  const sustain = notesMusicalArc(days, 'fullness', .1);
  if (sustain !== null) music.push(sustain > 0 ? 'Notes also linger longer toward the close.' : 'Notes become shorter toward the close.');
  if (settings.tension !== 'none') music.push(tense ? `A neighboring tone adds harmonic friction on ${tense} of ${total} days. That is an artistic mapping, not a health finding.` : 'The current tension mapping adds no neighboring tones.');
  if (missing) music.push(`${missing} unrecorded ${missing === 1 ? 'day plays a quiet neutral note' : 'days play quiet neutral notes'}; those passages represent missing information, not a worse period of life.`);

  const patterns = [];
  const evidence = [];
  const addPattern = (metric, label, text, count) => {
    patterns.push({metric, label, text});
    evidence.push({metric, label, count, total});
  };
  const sleep = notesValues(days, 'sleep');
  if (sleep.length >= NOTES_MIN_READINGS && sleep.length >= total * NOTES_MIN_COVERAGE) {
    const below = sleep.filter(hours => hours < settings.target).length;
    addPattern('sleep', 'Rest', `Recorded sleep had a median of ${notesNumber(median(sleep), 1)} hours. ${below} of ${sleep.length} recorded days were below your chosen ${notesNumber(settings.target, 2)}-hour target. In the music, extra hours do not add an unlimited reward.`, sleep.length);
  }
  const movementMetric = settings.rhythm === 'activity' ? 'activity' : 'steps';
  const movementValues = notesValues(days, movementMetric);
  if (movementValues.length >= NOTES_MIN_READINGS && movementValues.length >= total * NOTES_MIN_COVERAGE) {
    const unit = movementMetric === 'steps' ? 'steps' : 'active minutes';
    const trend = notesTrend(days, movementMetric, first => Math.max(movementMetric === 'steps' ? 500 : 5, first * .15));
    let text = `The median was ${notesNumber(median(movementValues))} ${unit} on recorded days.`;
    if (trend) text += ` The closing third's median was ${trend.direction} than the opening third's (${notesNumber(trend.first)} → ${notesNumber(trend.last)} ${unit}).`;
    text += ' This describes movement volume, not fitness or the value of a day.';
    addPattern(movementMetric, 'Movement', text, movementValues.length);
  }
  for (const metric of ['rhr', 'hrv']) {
    const readings = notesValues(days, metric);
    if (readings.length < NOTES_MIN_READINGS || readings.length < total * NOTES_MIN_COVERAGE) continue;
    const isRhr = metric === 'rhr';
    const label = isRhr ? 'Resting heart rate' : 'Heart-rate variability';
    const unit = isRhr ? 'bpm' : 'ms';
    const trend = notesTrend(days, metric, first => isRhr ? 2 : Math.max(5, first * .1));
    let text = `${label} had a median of ${notesNumber(median(readings), 1)} ${unit} across recorded days.`;
    if (trend) text += ` The closing third's median was ${trend.direction} than the opening third's (${notesNumber(trend.first, 1)} → ${notesNumber(trend.last, 1)} ${unit}).`;
    text += isRhr ? ' These readings alone cannot explain why.' : ' A higher value is not automatically a better outcome; the source and measurement method need to remain consistent.';
    addPattern(metric, label, text, readings.length);
  }
  const moods = notesValues(days, 'mood');
  if (moods.length >= NOTES_MIN_READINGS && moods.length >= total * NOTES_MIN_COVERAGE) {
    addPattern('mood', 'Recorded mood', `Recorded mood had a median of ${notesNumber(median(moods), 1)} on the supplied 1–5 scale. Mood is never inferred from physiology.`, moods.length);
  }
  const limited = METRICS.filter(metric => notesValues(days, metric).length > 0 && (notesValues(days, metric).length < NOTES_MIN_READINGS || notesValues(days, metric).length < total * NOTES_MIN_COVERAGE));
  const limits = [];
  if (!patterns.length) limits.push('There are too few consistently recorded measurements for a data interpretation. Each signal needs at least seven readings covering at least half the selected days.');
  else if (limited.length) limits.push('Some signals have limited coverage and are left out of the data interpretation.');
  if (!moods.length) limits.push('No mood entries were supplied; this piece cannot tell us how you felt.');
  limits.push('Comparisons describe the selected period, not causes, diagnoses, or treatment advice. Early and late thirds are compared only when both have enough readings.');
  return {title, music: music.join(' '), patterns, evidence, limits, covered, total, missing};
}
