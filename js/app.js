
(() => {
  const exercises = window.MUSICALA_EXERCISES || [];
  const $ = (q, root=document) => root.querySelector(q);
  const $$ = (q, root=document) => [...root.querySelectorAll(q)];
  const STORAGE='musicala-guitar-progress-v2';
  const THEME='musicala-guitar-theme';
  const state = JSON.parse(localStorage.getItem(STORAGE) || '{"done":[],"favorites":[],"last":null}');
  state.done ||= []; state.favorites ||= [];
  const els={cards:$('#cards'),search:$('#searchInput'),genre:$('#genreFilter'),status:$('#statusFilter'),count:$('#resultCount'),empty:$('#emptyState'),dialog:$('#exerciseDialog'),content:$('#dialogContent')};
  let currentId=null, metroTimer=null, audioCtx=null, bpm=80;

  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const save=()=>localStorage.setItem(STORAGE,JSON.stringify(state));
  const getEx=id=>exercises.find(e=>e.id===Number(id));
  const isDone=id=>state.done.includes(id), isFav=id=>state.favorites.includes(id);
  const label=e=>e.progression || (e.genres[0] ? `Ejercicio de ${e.genres[0]}` : 'Progresión por completar');
  const toast=msg=>{const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1700)};

  const genres=[...new Set(exercises.flatMap(e=>e.genres))].sort((a,b)=>a.localeCompare(b,'es'));
  genres.forEach(g=>els.genre.insertAdjacentHTML('beforeend',`<option value="${esc(g)}">${esc(g)}</option>`));

  function updateStats(){
    const done=state.done.filter(id=>getEx(id)).length, fav=state.favorites.filter(id=>getEx(id)).length;
    const pct=Math.round(done/exercises.length*100);
    $('#statProgress').textContent=pct+'%'; $('#statDone').textContent=done; $('#statFav').textContent=fav; $('#statTotal').textContent=exercises.length; $('#progressBar').style.width=pct+'%';
  }

  function filtered(){
    const q=els.search.value.trim().toLowerCase(), g=els.genre.value, s=els.status.value;
    return exercises.filter(e=>{
      const hay=[e.id,e.progression,...e.genres,...e.chordsEs].filter(Boolean).join(' ').toLowerCase();
      if(q && !hay.includes(q)) return false;
      if(g && !e.genres.includes(g)) return false;
      if(s==='done' && !isDone(e.id)) return false;
      if(s==='pending' && isDone(e.id)) return false;
      if(s==='favorite' && !isFav(e.id)) return false;
      if(s==='video' && !e.videoId) return false;
      return true;
    });
  }

  const rhythmSymbols = {
    d: ['Bajada', 'M12 4v15m-5-5 5 5 5-5'],
    u: ['Subida', 'M12 20V5m-5 5 5-5 5 5'],
    x: ['Golpe apagado', 'm7 7 10 10M17 7 7 17'],
    '-': ['Pausa', 'M7 12h10'],
    b: ['Bajo con el pulgar', null]
  };
  const rhythmIcon = key => key === 'b' ? '<b class="bass-letter" aria-hidden="true">B</b>' : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${rhythmSymbols[key][1]}"/></svg>`;
  const directionIcon = side => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${side === 'prev' ? 'm14 6-6 6 6 6' : 'm10 6 6 6-6 6'}"/></svg>`;

  function renderPattern(e, interactive) {
    const pattern = rhythmPatterns[e.id];
    return `<div class="rhythm">${[...pattern].map((key, i) => {
      const name = rhythmSymbols[key][0];
      const icon = rhythmIcon(key);
      return interactive
        ? `<button class="stroke stroke-${key === '-' ? 'rest' : key}" data-step="${i}" aria-label="${i+1}. ${name}" title="${name}">${icon}<small>${i+1}</small></button>`
        : `<span class="stroke stroke-${key === '-' ? 'rest' : key}" title="${name}">${icon}</span>`;
    }).join('')}</div>`;
  }

  function renderTab(bars, preview = false) {
    const strings = ['Mi', 'Si', 'Sol', 'Re', 'La', 'Mi'];
    let index = 0;
    return `<div class="tab-bars">${bars.map(bar => {
      const columns = bar.events.map(event => {
        const step = index++;
        const rest = event.frets === '.';
        const label = rest ? 'Silencio' : event.tied ? 'Ligadura' : [...event.frets].flatMap((fret, row) =>
          fret === '-' ? [] : [`cuerda ${row+1} ${fret === 'x' ? 'apagada' : 'traste '+fret}`]).join(', ');
        const cells = strings.map((_, row) => {
          const fret = event.frets[row];
          return `<span class="tab-cell">${fret && /[0-9x]/.test(fret) ? `<b>${fret}</b>` : ''}</span>`;
        }).join('');
        const marker = rest ? '—' : event.tied ? '⌒' : event.direction ? rhythmIcon(event.direction) : '';
        return preview
          ? `<span class="tab-event">${cells}</span>`
          : `<button type="button" class="tab-event" data-tab-step="${step}" aria-label="${label}" title="${label}"><span class="tab-marker">${marker}</span>${cells}</button>`;
      }).join('');
      return `<section class="tab-bar"><h3>${bar.name}</h3><div class="tab-grid" style="--steps:${bar.events.length}"><div class="tab-strings">${strings.map(name => `<span>${name}</span>`).join('')}</div>${columns}</div></section>`;
    }).join('')}</div>`;
  }

  function renderNotation(e) {
    const pattern = rhythmPatterns[e.id];
    const bars = tablatures[e.id];
    const original = `<section class="panel score-panel"><div class="panel-title"><h3>Partitura</h3><small>Notación del ejercicio</small></div><div class="notation"><img src="${e.image}" alt="Partitura del ejercicio ${e.id}"></div></section>`;
    if (!pattern && !bars) return original;
    return `<section class="panel interactive-score"><div class="panel-title"><h3>${bars ? `Tablatura · ${bars.meter}` : 'Patrón de rasgueo'}</h3><button class="primary" id="playScore">Escuchar</button></div>
      ${bars ? renderTab(bars.bars) : renderPattern(e, true)}
      <p>${bars ? 'Toca una columna para escuchar la nota o el acorde.' : 'Toca un símbolo para escucharlo. La demostración usa un paso por pulso.'}</p>
      </section>${original}`;
  }

  let scoreTimer;
  function stopScore() {
    clearTimeout(scoreTimer);
    scoreTimer = null;
    $$('.playing').forEach(el => el.classList.remove('playing'));
    const button = $('#playScore');
    if (button) button.textContent = 'Escuchar';
  }

  const tuning = [329.63, 246.94, 196, 146.83, 110, 82.41];
  function playNote(string, fret, delay = 0, duration = .55) {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime + delay;
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.value = tuning[string-1] * 2 ** (fret/12);
    gain.gain.setValueAtTime(.14, now);
    gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    oscillator.connect(gain).connect(audioCtx.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + .01);
  }

  function playStep(e, key, chordIndex = 0) {
    const chord = e.chords[chordIndex] || 'Em';
    if (key === 'b') playChord(chord, false, true);
    else if (key === 'x') metroClick(155);
    else if (key !== '-') playChord(chord, key === 'u');
  }

  function playTabEvent(event, duration) {
    if (event.tied || event.frets === '.') return;
    if (event.frets.includes('x')) return metroClick(155);
    [...event.frets].forEach((fret, row) => {
      if (fret === '-') return;
      const delay = event.direction === 'u' ? (5-row)*.012 : event.direction === 'd' ? row*.012 : 0;
      playNote(row+1, Number(fret), delay, duration);
    });
  }

  function playScore(e) {
    if (scoreTimer) return stopScore();
    const pattern = rhythmPatterns[e.id];
    const nodes = $$(pattern ? '[data-step]' : '[data-tab-step]', els.content);
    const events = pattern
      ? Array.from({length: Math.max(e.chords.length, 1)}, (_, chord) => [...pattern].map((key, i) => [nodes[i], 4, () => playStep(e, key, chord)])).flat()
      : tablatures[e.id].bars.flatMap(bar => bar.events).map((event, i, all) => {
        const sustain = all[i+1]?.tied ? all[i+1].duration : 0;
        return [nodes[i], event.duration, unit => playTabEvent(event, (event.duration+sustain)*unit/1000)];
      });
    let index = 0;
    const tick = () => {
      $$('.playing', els.content).forEach(el => el.classList.remove('playing'));
      if (index === events.length) return stopScore();
      const [node, duration, play] = events[index++];
      const unit = 60000 / bpm / 4;
      node.classList.add('playing');
      play(unit);
      scoreTimer = setTimeout(tick, duration*unit);
    };
    $('#playScore').textContent = 'Detener';
    tick();
  }

  function renderCards(){
    const list=filtered(); els.count.textContent=`${list.length} de ${exercises.length} ejercicios`; els.empty.hidden=!!list.length;
    els.cards.innerHTML=list.map(e=>`<article class="card ${isDone(e.id)?'done':''}" data-id="${e.id}">
      <span class="done-mark">✓ Practicado</span>
      <button type="button" class="card-media" data-open="${e.id}" aria-label="Abrir ejercicio ${e.id}">${rhythmPatterns[e.id] ? renderPattern(e, false) : renderTab(tablatures[e.id].bars.slice(0,1), true) }</button>
      <div class="card-body"><div class="card-top"><div><span class="number">EJERCICIO ${String(e.id).padStart(2,'0')}</span><h3>${esc(label(e))}</h3></div><button class="fav-btn ${isFav(e.id)?'active':''}" data-fav="${e.id}" aria-label="Favorito" aria-pressed="${isFav(e.id)}">${isFav(e.id)?'♥':'♡'}</button></div>
      <div class="tags">${e.genres.slice(0,3).map(g=>`<span class="tag">${esc(g)}</span>`).join('')}${e.videoId?'<span class="tag video">▶ Video</span>':''}${!e.genres.length?'<span class="tag">Sin género</span>':''}</div>
      <div class="card-actions"><button class="primary" data-open="${e.id}">Practicar</button><button class="tiny" data-done="${e.id}" aria-label="Practicado" aria-pressed="${isDone(e.id)}" title="Marcar como practicado">${isDone(e.id)?'✓':'○'}</button></div></div></article>`).join('');
  }

  function toggleDone(id){ id=Number(id); state.done=isDone(id)?state.done.filter(x=>x!==id):[...state.done,id]; state.last=id; save(); updateStats(); renderCards(); if(currentId===id) openExercise(id,true); toast(isDone(id)?'Ejercicio marcado como practicado':'Marcado como pendiente'); }
  function toggleFav(id){id=Number(id);state.favorites=isFav(id)?state.favorites.filter(x=>x!==id):[...state.favorites,id];save();renderCards();if(currentId===id)openExercise(id,true);toast(isFav(id)?'Guardado en favoritos':'Quitado de favoritos');}

  function chordSvg(name){
    const shapes={
      Am:{frets:['x',0,2,2,1,0]},A:{frets:['x',0,2,2,2,0]},E:{frets:[0,2,2,1,0,0]},C:{frets:['x',3,2,0,1,0]},Dm:{frets:['x','x',0,2,3,1]},D:{frets:['x','x',0,2,3,2]},Em:{frets:[0,2,2,0,0,0]},G:{frets:[3,2,0,0,0,3]},Fm:{frets:[1,3,3,1,1,1]},F:{frets:[1,3,3,2,1,1]},Bbm:{frets:['x',1,3,3,2,1]},Bb:{frets:['x',1,3,3,3,1]},Bm:{frets:['x',2,4,4,3,2]},Gm:{frets:[3,5,5,3,3,3]},'F#m':{frets:[2,4,4,2,2,2]},'C#m':{frets:['x',4,6,6,5,4]},'G#m':{frets:[4,6,6,4,4,4]},B:{frets:['x',2,4,4,4,2]}
    };
    const s=shapes[name]; if(!s) return '<svg viewBox="0 0 150 130"><text x="75" y="65" text-anchor="middle" fill="currentColor">'+esc(name)+'</text></svg>';
    const nums=s.frets.filter(x=>typeof x==='number'&&x>0), min=nums.length?Math.min(...nums):1, base=Math.max(1,min>1?min:1);
    let svg='<svg viewBox="0 0 150 155" aria-label="Diagrama '+esc(name)+'"><g stroke="currentColor" stroke-width="1.8" opacity=".75">';
    for(let i=0;i<6;i++){let x=25+i*20;svg+=`<line x1="${x}" y1="30" x2="${x}" y2="130"/>`;}
    for(let i=0;i<6;i++){let y=30+i*20;svg+=`<line x1="25" y1="${y}" x2="125" y2="${y}" ${i===0&&base===1?'stroke-width="4.5" stroke="currentColor"':''}/>`;}svg+='</g>';
    if(base>1) svg+=`<text x="6" y="52" font-size="12" font-weight="700" fill="currentColor">${base}fr</text>`;
    s.frets.forEach((f,i)=>{let x=25+i*20;if(f==='x')svg+=`<text x="${x}" y="20" text-anchor="middle" font-size="15" font-weight="bold" fill="currentColor">×</text>`;else if(f===0)svg+=`<circle cx="${x}" cy="15" r="5" fill="none" stroke="currentColor" stroke-width="2"/>`;else{let rel=f-base+1;let y=30+(rel-.5)*20;svg+=`<circle cx="${x}" cy="${y}" r="7.5" fill="var(--accent)" stroke="var(--raised)" stroke-width="1.5"/>`;}});
    return svg+'</svg>';
  }

  function playChord(name, reverse=false, bassOnly=false){
    const shapes={Am:['x',0,2,2,1,0],A:['x',0,2,2,2,0],E:[0,2,2,1,0,0],C:['x',3,2,0,1,0],Dm:['x','x',0,2,3,1],D:['x','x',0,2,3,2],Em:[0,2,2,0,0,0],G:[3,2,0,0,0,3],Fm:[1,3,3,1,1,1],F:[1,3,3,2,1,1],Bbm:['x',1,3,3,2,1],Bb:['x',1,3,3,3,1],Bm:['x',2,4,4,3,2],Gm:[3,5,5,3,3,3],'F#m':[2,4,4,2,2,2],'C#m':['x',4,6,6,5,4],'G#m':[4,6,6,4,4,4],B:['x',2,4,4,4,2]};
    const base=[82.41,110,146.83,196,246.94,329.63], f=shapes[name]; if(!f)return; audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();
    f.forEach((fr,i)=>{if(fr==='x' || (bassOnly && i !== f.findIndex(fret => fret !== 'x')))return;setTimeout(()=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='triangle';o.frequency.value=base[i]*Math.pow(2,fr/12);g.gain.setValueAtTime(.0001,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.09,audioCtx.currentTime+.015);g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+1.1);o.connect(g).connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+1.15)},(reverse ? 5-i : i)*23);});
  }

  function metroClick(frequency=920){
    audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();
    const o=audioCtx.createOscillator(),g=audioCtx.createGain();
    o.frequency.value=frequency;
    g.gain.setValueAtTime(.15,audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+.055);
    o.connect(g).connect(audioCtx.destination);
    o.start();o.stop(audioCtx.currentTime+.06);

    const pulse=$('#metroPulse');
    if(pulse){
      pulse.classList.add('flash');
      setTimeout(()=>pulse.classList.remove('flash'), 90);
    }
  }
  function stopMetro(){if(metroTimer){clearInterval(metroTimer);metroTimer=null;}const b=$('#metroBtn');if(b){b.classList.remove('on');b.textContent="▶ Iniciar";}}
  function startMetro(){stopMetro();metroClick();metroTimer=setInterval(metroClick,60000/bpm);const b=$('#metroBtn');if(b){b.classList.add('on');b.textContent='■ Detener';}}

  function openExercise(id,refresh=false){
    const e=getEx(id); if(!e)return; currentId=e.id; state.last=e.id; save(); stopMetro(); stopScore();
    const idx=exercises.findIndex(x=>x.id===e.id), prev=exercises[idx-1], next=exercises[idx+1];
    els.content.innerHTML=`<article class="detail"><header class="detail-head"><span class="number">EJERCICIO ${String(e.id).padStart(2,'0')}</span><h2 id="exerciseTitle">${esc(label(e))}</h2><p>${e.genres.length?e.genres.map(esc).join(' · '):'Ejercicio de acompañamiento y progresión'}</p></header>
      <div class="detail-grid"><div>${renderNotation(e)}
      ${e.videoId?`<button class="video-preview" id="loadVideo" type="button"><img src="https://i.ytimg.com/vi/${e.videoId}/hqdefault.jpg" alt="" loading="lazy" referrerpolicy="no-referrer"><span>Ver video explicativo</span></button><div id="videoMount"></div>`:''}</div>
      <aside class="side-panel"><section class="panel"><div class="panel-title"><h3>Progresión de acordes</h3><small>${e.chords.length} acordes</small></div>${e.chords.length?`<div class="chords">${e.chords.map((c,i)=>`<button class="chord" data-chord="${esc(c)}" title="Toca para escuchar acorde ${esc(c)}"><strong>${esc(e.chordsEs[i])} · ${esc(c)}</strong>${chordSvg(c)}</button>`).join('')}</div>`:'<p class="panel-empty">La progresión no está especificada en el archivo original. Se conserva el ejercicio tal como aparece en la fuente.</p>'}</section>
      <section class="panel"><div class="panel-title"><h3>Metrónomo interactivo</h3><small>Practica a tempo</small></div>
      <div class="metronome-box">
        <div class="metronome-row">
          <div class="metro-pulse" id="metroPulse" title="Pulso visual"></div>
          <button id="metroBtn" class="primary tiny metro-btn">▶ Iniciar</button>
          <div class="bpm-ctrl">
            <button class="bpm-btn" data-bpm-step="-5" title="-5 BPM">-5</button>
            <input id="bpmRange" type="range" min="40" max="200" value="${bpm}">
            <button class="bpm-btn" data-bpm-step="5" title="+5 BPM">+5</button>
          </div>
          <span id="bpmValue" class="bpm">${bpm} <small>BPM</small></span>
        </div>
      </div></section>
      <section class="panel"><div class="panel-title"><h3>Tu progreso</h3><small>Guardado automático</small></div><div class="detail-actions"><button class="primary" data-done-dialog="${e.id}">${isDone(e.id)?'✓ Practicado':'Marcar como practicado'}</button><button class="ghost" data-fav-dialog="${e.id}">${isFav(e.id)?'♥ En favoritos':'♡ Guardar en favoritos'}</button></div></section></aside></div>
      <nav class="nav-row"><button class="ghost" ${prev?'data-nav="'+prev.id+'"':'disabled'}>${directionIcon('prev')} ${prev?'Ejercicio '+prev.id:'Inicio'}</button><button class="ghost" ${next?'data-nav="'+next.id+'"':'disabled'}>${next?'Ejercicio '+next.id:'Final'} ${directionIcon('next')}</button></nav></article>`;
    if(!refresh && !els.dialog.open) els.dialog.showModal();
    history.replaceState(null,'',`#ejercicio-${e.id}`);
  }

  document.addEventListener('click',ev=>{
    const open=ev.target.closest('[data-open]');if(open)return openExercise(open.dataset.open);
    const fav=ev.target.closest('[data-fav]');if(fav){ev.stopPropagation();return toggleFav(fav.dataset.fav)}
    const done=ev.target.closest('[data-done]');if(done)return toggleDone(done.dataset.done);
    const dd=ev.target.closest('[data-done-dialog]');if(dd)return toggleDone(dd.dataset.doneDialog);
    const fd=ev.target.closest('[data-fav-dialog]');if(fd)return toggleFav(fd.dataset.favDialog);
    const nav=ev.target.closest('[data-nav]');if(nav)return openExercise(nav.dataset.nav,true);
    const chord=ev.target.closest('[data-chord]');if(chord)return playChord(chord.dataset.chord);
    const bpmStep=ev.target.closest('[data-bpm-step]');
    if(bpmStep){
      bpm = Math.max(40, Math.min(220, bpm + Number(bpmStep.dataset.bpmStep)));
      const r = $('#bpmRange'), v = $('#bpmValue');
      if(r) r.value = bpm;
      if(v) v.innerHTML = `${bpm} <small>BPM</small>`;
      if(metroTimer) startMetro();
      return;
    }
    if(ev.target.id==='metroBtn'){metroTimer?stopMetro():startMetro();return}
    const column = ev.target.closest('[data-tab-step]');
    if (column) {
      const event = tablatures[currentId].bars.flatMap(bar => bar.events)[Number(column.dataset.tabStep)];
      return playTabEvent(event, .55);
    }
    const step = ev.target.closest('[data-step]');
    if (step) {
      const exercise = getEx(currentId);
      return playStep(exercise, rhythmPatterns[exercise.id][Number(step.dataset.step)]);
    }
    if (ev.target.id === 'playScore') return playScore(getEx(currentId));
    const video = ev.target.closest('#loadVideo');
    if(video){const e=getEx(currentId);$('#videoMount').innerHTML=`<div class="video-box"><iframe src="https://www.youtube-nocookie.com/embed/${e.videoId}?autoplay=1" title="Demostración ejercicio ${e.id}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`;video.remove();}
  });

  document.addEventListener('keydown', ev=>{
    if(!els.dialog.open || ev.target.matches('input[type=range]')) return;
    if(ev.key==='ArrowLeft'){
      const idx=exercises.findIndex(x=>x.id===currentId);
      if(idx > 0) openExercise(exercises[idx-1].id, true);
    } else if(ev.key==='ArrowRight'){
      const idx=exercises.findIndex(x=>x.id===currentId);
      if(idx >= 0 && idx < exercises.length - 1) openExercise(exercises[idx+1].id, true);
    } else if(ev.key===' ' && !ev.target.closest('input, button, a, select')){
      ev.preventDefault();
      metroTimer ? stopMetro() : startMetro();
    }
  });

  ['input','change'].forEach(evt=>els.search.addEventListener(evt,renderCards)); els.genre.addEventListener('change',renderCards); els.status.addEventListener('change',renderCards);
  $('#closeDialog').addEventListener('click',()=>els.dialog.close()); els.dialog.addEventListener('close',()=>{stopMetro();stopScore();currentId=null;history.replaceState(null,'',location.pathname+location.search)});
  els.content.addEventListener('input',ev=>{if(ev.target.id==='bpmRange'){bpm=Number(ev.target.value);$('#bpmValue').innerHTML=`${bpm} <small>BPM</small>`;if(metroTimer)startMetro();}});
  $('#continueBtn').addEventListener('click',()=>openExercise(state.last && getEx(state.last)?state.last:exercises.find(e=>!isDone(e.id))?.id || exercises[0].id));
  $('#themeBtn').addEventListener('click',()=>{
    document.documentElement.classList.toggle('light');
    const l=document.documentElement.classList.contains('light');
    localStorage.setItem(THEME,l?'light':'dark');
    const ti = $('.theme-icon');
    if(ti) ti.textContent=l?'☾':'☼';
  });
  if(localStorage.getItem(THEME)==='light'){
    document.documentElement.classList.add('light');
    const ti = $('.theme-icon');
    if(ti) ti.textContent='☾';
  }
  updateStats();renderCards();
  const hash=location.hash.match(/^#ejercicio-(\d+)$/);if(hash && getEx(hash[1]))setTimeout(()=>openExercise(hash[1]),50);
  if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(()=>{});
})();
