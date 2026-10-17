# Year in Sound

Your health data in musical form.

A browser-local prototype that turns a calendar year of wearable measurements and recorded mood into a personal musical composition. Includes a deterministic synthetic demo, an interactive year timeline, local file mapping, live synthesis, and WAV export.

## Try it

Requires Node.js 20 or newer. There are no package dependencies or install step.

```sh
npm run dev
```

Open the printed address: http://127.0.0.1:58431

Press Play for the demo. Adjust the musical mappings, sound palette, sensitivity, and 30–180 second duration. Choose a month to audition it. The WAV download includes a short two-second release tail. The timeline is keyboard accessible: Tab to a day, then use Left/Right or Home/End.

```sh
npm test
```

A standalone `year-in-sound.html` is supplied beside the source archive for opening directly in a regular browser. It bundles the same styles and logic without requiring a server. The built-in app browser blocks the `file:` protocol, so direct-file browser execution was not verified there; the bundled script passed a syntax check, and the modular app was browser-tested through the local server.

## GitHub and Netlify

Use **this folder** as the repository root, with `netlify.toml`, `package.json`, and `dist/` at its top level. Connect that GitHub repository to Netlify using its normal Git publishing flow.

- Publish directory: `dist`
- Build command: leave empty
- Environment variables / API keys: none
- Framework: none; this is a static HTML/CSS/JavaScript application

The included Netlify configuration adds a content security policy that blocks application fetch/XHR connections, plus frame protection, MIME sniffing protection, and restrictive device permissions. Future live API integrations will require intentionally updating this policy.

Source repository: https://github.com/erramirez/health-score. Netlify configuration is included; no website deployment has been published yet.

## Imports

Use the Download sample CSV button for an example year. CSV and JSON imports expect **one daily summary per date**. A JSON file is an array of objects using the same fields as CSV. Column names can differ; confirm them in the preview.

```csv
date,rhr,hrv,sleep,steps,activity,mood
2025-01-01,60,42,7.5,7000,30,4
2025-01-02,62,,6.75,5000,20,
```

| Field | Units / supported values |
| --- | --- |
| date | YYYY-MM-DD, valid calendar date |
| rhr | Resting heart rate, bpm, 20–250 |
| hrv | Milliseconds, >0–1000, one consistent method and source |
| sleep | Hours asleep, 0–24; not time in bed |
| steps | Daily count, 0–200,000 |
| activity | Active minutes, 0–1440 |
| mood | Recorded scale of 1–5 |

These bounds catch some unit mistakes; they are not medical thresholds. Convert minutes of sleep to hours and other mood scales to 1–5 before import. Blank values stay unknown. Duplicate dates are rejected. Invalid dates are skipped and counted; an import with no usable measurements is rejected. Unmapped fields are discarded on confirmation.

Apple Health: unzip the export first and select `export.xml`. This parser reads it incrementally and extracts resting HR, HRV, sleep, steps, and Apple exercise minutes. It chooses one source per metric based on record count and lists those source names in the preview. It uses daily medians for RHR/HRV, sums steps and exercise minutes, excludes awake/in-bed sleep records, and merges overlapping asleep intervals. HRV in seconds is converted to milliseconds. Sleep intervals are grouped by their ending date. This is a prototype aggregation, not Apple's own daily summary algorithm: review it when changing devices, travelling across time zones, or using unusual sleep schedules. The file limit is 300 MB; selecting a smaller daily summary is preferable for large histories. File parsing is local but may be slow on older phones.

Fitbit and Garmin: use daily CSV/JSON summaries with confirmed units. Their full native archives and live OAuth connections are not implemented. Multiple imports replace the composition rather than merging devices or HRV methods. Apple SDNN and RMSSD readings should not be combined as one numerical series.

## Musical interpretation

This is an artistic sonification, not a health score, diagnosis, or validated physiological model.

- Melody: recorded mood (1–5), capped HRV change, or sleep adequacy.
- Rhythm: steps or active minutes, scaled against the year's 90th percentile; more events represent movement, not better health.
- Tension: resting-HR elevation, HRV suppression, sleep shortfall, or none. A quiet neighboring tone introduces tension.
- Sustain/fullness: hours asleep divided by the chosen sleep target, capped at 1. More sleep beyond the target does not earn extra fullness.
- Annual interpretation: RHR and HRV are compared with their median across the selected calendar year, preserving broad annual contrasts.
- Baseline interpretation: RHR and HRV are compared with the preceding 28 calendar days, requiring at least seven readings. Current-day readings are excluded. Baselines are calculated before month filtering so earlier history remains available.
- Unknown melody fields use a neutral pitch; fully missing days play quiet neutral notes. Missing measurements are never converted to zero.
- Sensitivity changes artistic contrast. HRV melody benefits are capped even at expressive sensitivity. Unusually high HRV is not treated as unlimited evidence of recovery.

One day is one main musical event. Weekly/monthly structure is shown through the calendar timeline; a richer arrangement and explicit month transitions are future work. The musical curves and constants are creative heuristics. A personal baseline may reflect ongoing illness, medication, training, or other circumstances; the app makes no clinical inference.

## Privacy and retention

- No health data uploads, external assets, analytics, application network calls, cookies, localStorage, IndexedDB, or service workers.
- Imported values and composition state remain in temporary JavaScript memory.
- Clear session releases application references and resets the UI. Page exit attempts the same cleanup; restored pages clear again. Fifteen minutes without user interaction clears the session. Backgrounding pauses audio.
- Browser/OS memory management, swap, crash behavior, and secure erasure are outside the application's control. In-progress parsing/rendering may retain temporary data until the operation finishes. Closing a page is not a guarantee of immediate secure erasure.
- Original files, downloaded WAVs, and CSVs remain on the user's device. The website does not delete them.
- A hosting provider can retain ordinary access metadata such as IP addresses; imported health-file contents are not submitted to it.

## Files

- `dist/index.html`, `dist/style.css`: responsive studio and dialogs
- `dist/core.js`: normalization, demo, mapping logic, CSV/Apple parsing
- `dist/audio.js`: synthesis and PCM WAV encoding
- `dist/app.js`: session-only UI and transport
- `server.mjs`: minimal local preview server
- `tests/core.test.js`: import, calendar, physiology mapping, and audio format checks

## Verification

Nine automated tests pass. Browser checks covered demo playback, actual WAV rendering/download, CSV mapping, leap-year coverage, month selection, musical-mapping changes, session clearing, and a 390 px phone layout without horizontal overflow. The exported synthetic demo WAV was checked for a valid format and non-silent samples. Apple XML aggregation was tested with chunked synthetic records, overlapping sleep, duplicate device sources, and HRV unit conversion. No full personal export or live provider API was available for testing.
