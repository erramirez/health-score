import {METRICS,calendar,demoData,parseCSV,normalize,suggest,sonify,parseApple} from './core.js';
import {scheduleDay,outputBus,encodeWav} from './audio.js';
import {writeLinerNotes} from './liner-notes.js';
import {availableSignals,defaultMusicalMappings,preferredYear} from './import-flow.js';
const $=id=>document.getElementById(id),months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
let raw=[],source='empty',pending=null,pendingSources=[],days=[],music=[],ctx=null,bus=null,timer=null,playing=false,offset=0,startTime=0,next=0,selected=0,epoch=0,busy=false,lastActivity=Date.now(),importEpoch=0;
const names={date:'Date · YYYY-MM-DD',rhr:'Resting heart rate · bpm',hrv:'HRV · milliseconds',sleep:'Time asleep · hours',steps:'Steps · daily count',activity:'Active minutes',mood:'Mood · 1–5'};
const settings=()=>({interpretation:$('interpretation').value,melody:$('melody').value,rhythm:$('rhythm').value,tension:$('tension').value,target:Number($('sleep-target').value)||8,sensitivity:Number($('sensitivity').value),palette:$('palette').value,duration:Number($('duration').value)});
const time=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
const fullDate=s=>new Date(s+'T12:00:00Z').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'});
function status(s){$('status').textContent=s}
function setYears(){
  const years=[...new Set(raw.map(d=>d.date.slice(0,4)))].sort().reverse();
  $('year').replaceChildren(...years.map(y=>new Option(y,y)));
  if(!years.length)$('year').append(new Option('No data','2025'));
  else $('year').value=preferredYear(raw)||years[0];
}
function syncJourney(stage=source==='empty'?'add':'listen'){
  const loaded=source!=='empty';
  $('workspace').hidden=!loaded;
  $('dataset-bar').hidden=!loaded;
  $('start-card').classList.toggle('has-data',loaded);
  const current={add:0,confirm:1,listen:2}[stage];
  ['flow-add','flow-confirm','flow-listen'].forEach((id,index)=>{
    $(id).classList.toggle('is-complete',index<current);
    if(index===current)$(id).setAttribute('aria-current','step');
    else $(id).removeAttribute('aria-current');
  });
  if(!loaded){$('dataset-bar').dataset.source='';$('dataset-kind').textContent='';$('dataset-summary').textContent='';$('dataset-signals').replaceChildren();return;}
  $('dataset-bar').dataset.source=source;
  $('dataset-kind').textContent=source==='demo'?'EXAMPLE ONLY · SYNTHETIC DATA':'YOUR DATA · ON THIS DEVICE';
  const recorded=raw.filter(day=>METRICS.some(metric=>Number.isFinite(day[metric])));
  const range=recorded.length?`${fullDate(recorded[0].date)} – ${fullDate(recorded.at(-1).date)}`:'';
  $('dataset-summary').textContent=source==='demo'?'You’re exploring an example. Add your own file to create your soundtrack.':`${recorded.length.toLocaleString()} recorded days · ${range}`;
  $('dataset-signals').replaceChildren(...availableSignals(raw).map(metric=>notesElement('span',({rhr:'Resting HR',hrv:'HRV',sleep:'Sleep',steps:'Steps',activity:'Active minutes',mood:'Mood'})[metric])));
}
function useAvailableMappings(){
  const selectedRows=raw.filter(row=>row.date.startsWith($('year').value+'-'));
  const defaults=defaultMusicalMappings(selectedRows),available=new Set(availableSignals(selectedRows));
  for(const [id,value]of Object.entries(defaults)){
    $(id).value=value;
    for(const option of $(id).options)option.disabled=option.value!=='none'&&!available.has(option.value);
  }
}
function importFeedback(message='',error=false){
  $('import-feedback').textContent=message;
  $('import-feedback').classList.toggle('is-error',error);
  $('import-feedback').setAttribute('role',error?'alert':'status');
}
function setReading(reading){
  $('start-card').setAttribute('aria-busy',String(reading));
  $('choose-file').disabled=reading;
  $('replace-file').disabled=reading;
}
function coverage(){return days.filter(d=>d.hasData).length}
function rebuild(){resetLinerNotes();stop();offset=0;$('seek').value=0;epoch++;syncJourney();const s=settings();if(source==='empty'){days=[];music=[];$('year-chart').replaceChildren();$('month-labels').replaceChildren();$('day-detail').replaceChildren();$('source-pill').textContent='No data loaded';$('composition-title').textContent='Add your data to begin.';$('track-name').textContent='Your composition';$('coverage').textContent='No data loaded';$('write-notes').disabled=true;$('play').disabled=true;$('download').disabled=true;updateTime();return;}const byDate=new Map(raw.map(d=>[d.date,d]));const yearDays=calendar(Number($('year').value)).map(d=>byDate.get(d.date)||d);const all=sonify(yearDays,s);days=$('period').value==='all'?all:all.filter(d=>new Date(d.date).getUTCMonth()===Number($('period').value));music=days;selected=0;$('duration-label').textContent=s.duration+' seconds';$('key-label').textContent=(s.palette==='warm'?'A':'C')+' PENTATONIC · '+s.palette.toUpperCase();$('mode-help').textContent=s.interpretation==='annual'?'Compare days across the year. Keep seasonal changes audible.':'Compare with the previous 28 days (at least 7 readings). Early days stay neutral.';$('source-pill').replaceChildren();const dot=document.createElement('span');$('source-pill').append(dot,document.createTextNode(source==='demo'?`Synthetic demo · ${$('year').value}`:source==='empty'?'No data loaded':`Local import · ${$('year').value}`));$('composition-title').textContent=source==='empty'?'Your next composition starts here.':`${days.length} days. One composition.`;$('track-name').textContent=source==='empty'?'Import a year to begin':$('period').value==='all'?'A year in motion':`${months[Number($('period').value)]}, in motion`;$('coverage').textContent=`${coverage()} of ${days.length} days with data · ${source==='demo'?'Synthetic demo':source==='empty'?'Nothing retained':'Local file'}`;$('write-notes').disabled=coverage()===0;$('play').disabled=coverage()===0;$('download').disabled=coverage()===0||busy;renderChart();updateTime();}
function renderChart(){const frag=document.createDocumentFragment();days.forEach((d,i)=>{const b=document.createElement('button');b.type='button';b.tabIndex=i===selected?0:-1;b.className='day-bar'+(!d.hasData?' missing':'');const h=d.hasData?24+(d.fullness??.5)*70+(d.movement??0)*75+(d.color??.5)*25:8;b.style.height=h+'px';const mood=d.mood==null?.5:(d.mood-1)/4;const hue=80-(d.movement??0)*37-(mood>.75?15:0);b.style.setProperty('--day-color',d.hasData?`hsl(${hue} 22% ${64+(d.fullness??.5)*14}%)`:'#a1b29a');b.setAttribute('aria-label',`${fullDate(d.date)}, ${d.hasData?'inspect measurements':'no data'}`);b.title=`${fullDate(d.date)}${d.hasData?'':' · No data'}`;b.addEventListener('click',()=>inspect(i));frag.append(b)});$('year-chart').replaceChildren(frag);$('month-labels').replaceChildren(...($('period').value==='all'?months:['01','08','15','22',String(days.length)]).map(m=>{const span=document.createElement('span');span.textContent=m.toUpperCase();return span}));inspect(0)}
$('year-chart').addEventListener('keydown',e=>{let i=selected;if(e.key==='ArrowRight')i=Math.min(days.length-1,i+1);else if(e.key==='ArrowLeft')i=Math.max(0,i-1);else if(e.key==='Home')i=0;else if(e.key==='End')i=days.length-1;else return;e.preventDefault();inspect(i);$('year-chart').children[i]?.focus();});
function inspect(i){selected=i;const previous=document.querySelector('.day-bar.selected');if(previous){previous.classList.remove('selected');previous.tabIndex=-1;}if($('year-chart').children[i]){$('year-chart').children[i].classList.add('selected');$('year-chart').children[i].tabIndex=0;}const d=days[i];if(!d)return;const fields=METRICS.filter(k=>Number.isFinite(d[k])).map(k=>`${({rhr:'Resting HR',hrv:'HRV',sleep:'Sleep',steps:'Steps',activity:'Active',mood:'Mood'})[k]} ${k==='sleep'?d[k].toFixed(1):Math.round(d[k]).toLocaleString()}${({rhr:' bpm',hrv:' ms',sleep:' h',steps:'',activity:' min',mood:'/5'})[k]}`);$('day-detail').replaceChildren();const strong=document.createElement('strong');strong.textContent=fullDate(d.date);$('day-detail').append(strong,document.createElement('br'),document.createTextNode(fields.length?fields.join(' · '):'No measurements. This day plays a quiet neutral note.'));}
function updateTime(){const duration=settings().duration;$('time').textContent=`${time(offset)} / ${time(duration)}`;if(!playing)$('play-date').textContent=days.length?`${months[new Date(days[0].date).getUTCMonth()]} → ${months[new Date(days.at(-1).date).getUTCMonth()]} · ${$('year').value}`:'';}
function stop(){if(playing&&ctx)offset=Math.min(settings().duration,Math.max(0,ctx.currentTime-startTime));playing=false;clearInterval(timer);timer=null;if(ctx){ctx.close().catch(()=>{});ctx=null;bus=null}$('play').textContent='▶';$('play').setAttribute('aria-label','Play composition');document.querySelector('.day-bar.current')?.classList.remove('current');updateTime();}
async function play(){if(playing){stop();return}if(!coverage())return;try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error('This browser does not support Web Audio. Try a current Safari, Chrome, or Firefox.');if(offset>=settings().duration)offset=0;ctx=new Audio();await ctx.resume();bus=outputBus(ctx);startTime=ctx.currentTime-offset+.06;next=Math.floor(offset/settings().duration*music.length);playing=true;$('play').textContent='Ⅱ';$('play').setAttribute('aria-label','Pause composition');const tick=()=>{if(!ctx||!playing)return;offset=Math.max(0,ctx.currentTime-startTime);const step=settings().duration/music.length;while(next<music.length&&startTime+next*step<ctx.currentTime+.3){scheduleDay(ctx,bus,music[next],next,Math.max(ctx.currentTime+.005,startTime+next*step),step,settings().palette);next++}const i=Math.min(music.length-1,Math.floor(offset/step));document.querySelector('.day-bar.current')?.classList.remove('current');$('year-chart').children[i]?.classList.add('current');$('seek').value=Math.round(offset/settings().duration*1000);$('time').textContent=`${time(offset)} / ${time(settings().duration)}`;$('play-date').textContent=fullDate(music[i].date);if(offset>=settings().duration){stop();offset=0;$('seek').value=0;updateTime()}};tick();timer=setInterval(tick,80);}catch(e){stop();status(e.message)}}
$('choose-file').onclick=()=>$('file').click();
$('replace-file').onclick=()=>$('file').click();
$('play').onclick=play;$('seek').oninput=()=>{const was=playing;stop();offset=Number($('seek').value)/1000*settings().duration;updateTime();if(was)play()};
for(const id of ['year','period','interpretation','duration','palette','sensitivity','melody','rhythm','tension','sleep-target'])$(id).addEventListener('change',()=>{if(id==='year')useAvailableMappings();if(id==='sleep-target'&&!$('sleep-target').checkValidity()){ $('sleep-target').value=8;status('Sleep target reset to 8 hours; choose a value between 5 and 12.')}rebuild()});
$('duration').oninput=()=>{$('duration-label').textContent=$('duration').value+' seconds'};
$('mappings').onclick=()=>$('mapping-dialog').showModal();
function resetLinerNotes(){
  if(!$('notes-output').hidden)status('Composition changed. Write fresh liner notes for this version.');
  $('notes-output').replaceChildren();
  $('notes-output').hidden=true;
  $('write-notes').textContent='Write my liner notes ↗';
}
function notesElement(tag, text, className){
  const element=document.createElement(tag);
  if(text) element.textContent=text;
  if(className) element.className=className;
  return element;
}
$('write-notes').onclick=()=>{
  const result=writeLinerNotes(music,settings());
  if(!result)return;
  const output=$('notes-output');
  const period=$('period').value==='all'?'Full year':months[Number($('period').value)];
  const meta=notesElement('div', `${$('year').value} · ${period} · ${result.covered} of ${result.total} days recorded`, 'notes-meta');
  const sourceLabel=notesElement('span',source==='demo'?'Synthetic demo · not personal data':'Your local import','notes-source');
  meta.append(sourceLabel);
  const heading=notesElement('h3',result.title);
  const reading=notesElement('div',null,'notes-reading');
  const musical=notesElement('section');
  musical.append(notesElement('h4','What you hear'),notesElement('p',result.music));
  const data=notesElement('section');
  data.append(notesElement('h4','Patterns in your data'));
  for(const pattern of result.patterns){
    const item=notesElement('div',null,'notes-pattern');
    item.append(notesElement('h5',pattern.label),notesElement('p',pattern.text));
    const evidence=result.evidence.find(entry=>entry.metric===pattern.metric);
    item.append(notesElement('span',`${evidence.count} of ${evidence.total} days recorded`,'notes-evidence'));
    data.append(item);
  }
  if(!result.patterns.length)data.append(notesElement('p','The music can still tell a story, but these records are too sparse for a reliable description of data patterns.','notes-insufficient'));
  reading.append(musical,data);
  const limits=notesElement('p',result.limits.join(' '),'notes-limits');
  output.replaceChildren(meta,heading,reading,limits);
  output.hidden=false;
  status('Liner notes written locally. Changing the composition or clearing the session removes them.');
};

function resetSound(){for(const [k,v]of Object.entries({interpretation:'annual',duration:'60',palette:'ambient',sensitivity:'1',melody:'mood',rhythm:'steps',tension:'rhr','sleep-target':'8'}))$(k).value=v;if(source!=='empty')useAvailableMappings();rebuild()}
$('reset').onclick=resetSound;
function save(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('download').onclick=async()=>{stop();if(!coverage())return;const ownEpoch=epoch,s=settings(),data=music.map(d=>({...d}));busy=true;$('download').disabled=true;status('Rendering your composition locally…');try{const off=new OfflineAudioContext(1,Math.ceil((s.duration+2)*22050),22050),out=outputBus(off);data.forEach((d,i)=>scheduleDay(off,out,d,i,.05+i*s.duration/data.length,s.duration/data.length,s.palette));const buffer=await off.startRendering();if(epoch!==ownEpoch){status('Composition changed; export discarded. Export again for the current settings.');return}save(encodeWav(buffer),`year-in-sound-${$('year').value}.wav`);status('WAV ready. Your composition was rendered entirely on this device.');}catch(e){status('Audio export failed: '+e.message)}finally{busy=false;$('download').disabled=!coverage()}};
$('sample').onclick=()=>{const headers=['date',...METRICS],rows=demoData();save(new Blob([headers.join(',')+'\n'+rows.map(r=>headers.map(k=>r[k]??'').join(',')).join('\n')],{type:'text/csv'}),'year-in-sound-sample.csv')};
$('demo').onclick=()=>{
  importEpoch++;pending=null;pendingSources=[];setReading(false);importFeedback();
  raw=demoData();source='demo';setYears();$('period').value='all';useAvailableMappings();rebuild();
  status('Example ready. This is synthetic data; use your own file to make it personal.');
  $('dataset-bar').scrollIntoView({behavior:'auto',block:'start'});
};
function clear(){importEpoch++;stop();epoch++;raw=[];pending=null;pendingSources=[];source='empty';setReading(false);importFeedback();$('file').value='';$('column-mappings').replaceChildren();$('import-summary').textContent='';$('import-error').textContent='';$('hrv-method').value='unknown';for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();setYears();$('period').value='all';for(const id of ['melody','rhythm','tension'])for(const option of $(id).options)option.disabled=false;resetSound();status('Session cleared. Original files and downloads on your device are unchanged.')}
$('clear').onclick=()=>{clear();$('start-card').scrollIntoView({behavior:'auto',block:'start'});$('choose-file').focus({preventScroll:true});};
function updateColumnSample(metric){
  const column=$('map-'+metric).value;
  const example=pending?.map(row=>row[column]).find(value=>value!==null&&value!==undefined&&String(value).trim()!=='');
  $('sample-'+metric).textContent=!column?'Not included':example===undefined?'No recorded values':`Example: ${String(example).slice(0,70)}`;
  if(metric==='hrv')$('hrv-method').closest('label').hidden=!column;
  $('import-error').textContent='';
}
function preview(rows,sourceNotes=[]){
  if(!Array.isArray(rows)||!rows.length||rows.some(row=>!row||typeof row!=='object'||Array.isArray(row)))throw Error('Use a JSON array of daily objects, or a CSV with a header.');
  const headers=[...new Set(rows.flatMap(row=>Object.keys(row)))];
  if(headers.length>100)throw Error('This prototype supports up to 100 columns. Export daily summaries.');
  pending=rows;pendingSources=sourceNotes;
  const map=suggest(headers);
  $('column-mappings').replaceChildren();$('import-error').textContent='';
  for(const metric of ['date',...METRICS]){
    const field=notesElement('div',null,'field');
    const label=notesElement('label',names[metric]);label.htmlFor='map-'+metric;
    const select=document.createElement('select');select.id='map-'+metric;
    select.setAttribute('aria-describedby','sample-'+metric);
    select.append(new Option(metric==='date'?'Choose date field':'Not available / skip',''));
    headers.forEach(header=>select.append(new Option(header,header)));
    select.value=map[metric];
    const sample=notesElement('span',null,'column-sample');sample.id='sample-'+metric;
    select.addEventListener('change',()=>updateColumnSample(metric));
    field.append(label,select,sample);$('column-mappings').append(field);updateColumnSample(metric);
  }
  $('hrv-method').value=sourceNotes.length?'SDNN':'unknown';
  $('import-summary').textContent=`${rows.length.toLocaleString()} rows found. Match the date and any measurements you want to use. Check the examples and units. ${sourceNotes.length?'Apple sources selected by record count: '+sourceNotes.join('; ')+'. Overlapping sleep intervals are merged.':''}`;
  syncJourney('confirm');$('import-dialog').showModal();
}
async function loadFile(file){
  if(!file)return;
  const token=++importEpoch;
  try{
    setReading(true);importFeedback('Reading your file on this device…');
    if(file.size>300*1024*1024)throw Error('Choose a file smaller than 300 MB. A daily-summary export is best for large histories.');
    const extension=file.name.split('.').at(-1).toLowerCase();
    if(!['xml','csv','json'].includes(extension))throw Error('Choose CSV, JSON, or uncompressed XML. Unzip Apple Health archives first.');
    if(extension==='xml'){
      const parsed=await parseApple(file,count=>{if(token===importEpoch)importFeedback(`Reading Apple Health locally… ${count.toLocaleString()} relevant records`);});
      if(token!==importEpoch)return;preview(parsed.rows,parsed.sources);
    }else{
      const text=await file.text();if(token!==importEpoch)return;
      preview(extension==='csv'?parseCSV(text):JSON.parse(text));
    }
    importFeedback('File read. Confirm the fields to create your composition.');
  }catch(error){if(token===importEpoch){pending=null;pendingSources=[];syncJourney();importFeedback(error.message,true);}}
  finally{if(token===importEpoch)setReading(false);$('file').value='';}
}
$('file').onchange=event=>loadFile(event.target.files[0]);
for(const eventName of ['dragenter','dragover'])$('drop-zone').addEventListener(eventName,event=>{event.preventDefault();$('drop-zone').classList.add('is-dragging');});
for(const eventName of ['dragleave','drop'])$('drop-zone').addEventListener(eventName,event=>{event.preventDefault();$('drop-zone').classList.remove('is-dragging');});
$('drop-zone').addEventListener('drop',event=>{
  const files=event.dataTransfer.files;
  if(files.length!==1){importFeedback('Please choose one data file at a time.',true);return;}
  loadFile(files[0]);
});
function cancelImport(){
  $('import-dialog').close();pending=null;pendingSources=[];$('column-mappings').replaceChildren();$('import-summary').textContent='';$('import-error').textContent='';
  syncJourney();importFeedback('Import cancelled. Choose another file whenever you’re ready.');
}
$('cancel-import').onclick=cancelImport;$('import-dialog').addEventListener('cancel',event=>{event.preventDefault();cancelImport();});
$('confirm-import').onclick=()=>{
  try{
    if(!pending)throw Error('Choose a file first.');
    const map=Object.fromEntries(['date',...METRICS].map(metric=>[metric,$('map-'+metric).value]));
    if(!map.date){$('map-date').focus();throw Error('Choose the column containing dates in YYYY-MM-DD format.');}
    const mapped=Object.values(map).filter(Boolean);
    if(new Set(mapped).size!==mapped.length)throw Error('Each column can be used only once. Check the selected fields.');
    const result=normalize(pending,map);
    raw=result.days;pending=null;source='import';setYears();$('period').value='all';useAvailableMappings();
    $('import-dialog').close();$('column-mappings').replaceChildren();$('import-summary').textContent='';$('import-error').textContent='';pendingSources=[];
    rebuild();importFeedback('Your file is ready. Everything stays on this device.');
    status(`Your composition is ready. Press play to hear it.${result.skipped?` ${result.skipped} rows were skipped because their dates were missing or invalid.`:''}`);
    $('dataset-bar').scrollIntoView({behavior:'auto',block:'start'});$('play').focus({preventScroll:true});
  }catch(error){$('import-error').textContent=error.message;}
};
function info(title,html){$('info-title').textContent=title;$('info-body').innerHTML=html;$('info-dialog').showModal()}
$('privacy').onclick=()=>info('A private listening room.','<p>Health files are parsed, music is generated, and liner notes are written in this browser. The notes use local rules; no AI service receives your data or music. This prototype makes no API calls, uses no analytics, and saves no health data to cookies or browser storage.</p><p>Use Clear session to remove the notes and release the app’s references to imported values, or let it reset after 15 minutes without interaction. Audio pauses when the tab is hidden. Browser memory release is managed by the browser; secure erasure is not guaranteed. Original files and downloads remain on your device.</p><p>Netlify or another host may retain ordinary request metadata such as IP addresses. Imported file contents are never submitted to the host.</p>');
$('about').onclick=()=>info('A translation, not a diagnosis.','<p>Activity controls rhythmic density, not a health grade. Sleep controls sustain and fullness, capped at your chosen target. Resting-heart-rate elevation can introduce a quiet neighboring tone to create tension. HRV suppression can do the same; HRV increases never earn unlimited rewards.</p><p>Annual mode compares physiological readings with the annual median. Baseline mode uses a preceding 28-day median with at least 7 readings, including history before a selected month. These are artistic heuristics, not validated health thresholds. A personal baseline can also reflect ongoing illness or other circumstances.</p><p>Unknown melody inputs play a neutral pitch. Missing days use quiet neutral notes. Recorded mood uses a 1–5 scale; physiology never supplies a mood label. Changing device or HRV method requires a separate import.</p><p>Apple XML: one source per signal is chosen by record count; verify the source names in the preview. Sleep is grouped by the end date of each interval. Source changes, time-zone travel, and unusual sleep patterns need review. ZIP archives, live APIs, sleep stages, and automatic cross-device harmonization are outside this prototype.</p>');
for(const name of ['pointerdown','keydown','input'])document.addEventListener(name,()=>lastActivity=Date.now(),{passive:true});setInterval(()=>{if(source!=='empty'&&Date.now()-lastActivity>15*60*1000)clear()},30000);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});window.addEventListener('pagehide',clear);window.addEventListener('pageshow',e=>{if(e.persisted)clear()});
setYears();rebuild();
