const $ = id => document.getElementById(id);

const DESC = {
  FIFO: '<b style="color:var(--txt)">First-In First-Out.</b> Evicts the page that has been in memory the longest, regardless of how often it is used. Simple, but can suffer from Belady\'s anomaly.',
  LRU: '<b style="color:var(--txt)">Least Recently Used.</b> Evicts the page that has gone the longest without being referenced, assuming recent past predicts near future.',
  OPT: '<b style="color:var(--txt)">Optimal (Belady).</b> Evicts the page whose next use is farthest in the future. Needs future knowledge, so it is the theoretical lower bound for faults.'
};
const NAMES = { FIFO: 'FIFO', LRU: 'LRU', OPT: 'Optimal' };
const COLORS = { FIFO: 'var(--acc)', LRU: 'var(--acc2)', OPT: 'var(--hit)' };
const PRESETS = {
  Classic: '7 0 1 2 0 3 0 4 2 3 0 3 2 1 2 0 1 7 0 1',
  Belady: '1 2 3 4 1 2 5 1 2 3 4 5',
  Locality: '1 2 3 1 2 3 1 2 4 1 2 4 5 1 2 5',
  Sequential: '1 2 3 4 5 6 1 2 3 4 5 6'
};

const S = { refs: [], n: 3, algo: 'FIFO', steps: [], i: 0, timer: null };

/* ---------- Core simulation (precomputes every step) ---------- */
function sim(algo, refs, n) {
  const fr = Array(n).fill(null), ld = Array(n).fill(0), us = Array(n).fill(0), out = [];
  refs.forEach((p, t) => {
    const at = fr.indexOf(p);
    const hit = at > -1;
    let slot = at, ev = null, why = '';
    if (hit) {
      us[at] = t;
      why = `Page <code>${p}</code> is already in <b>Frame ${at + 1}</b>, so no memory fetch is needed.`;
    } else {
      const empty = fr.indexOf(null);
      if (empty > -1) {
        slot = empty;
        why = `Page <code>${p}</code> is not in memory. <b>Frame ${empty + 1}</b> is empty, so it is loaded there with nothing evicted.`;
      } else {
        if (algo === 'FIFO') {
          slot = ld.indexOf(Math.min(...ld));
          why = 'it entered memory earliest (first in)';
        } else if (algo === 'LRU') {
          slot = us.indexOf(Math.min(...us));
          why = 'it was used least recently';
        } else {
          const nx = fr.map(x => { const k = refs.indexOf(x, t + 1); return k < 0 ? Infinity : k; });
          slot = nx.indexOf(Math.max(...nx));
          why = nx[slot] === Infinity ? 'it is never referenced again' : `its next use is farthest away (at position ${nx[slot] + 1})`;
        }
        ev = fr[slot];
        why = `Page <code>${p}</code> is not in memory and all frames are full. Evicting <code>${ev}</code> from <b>Frame ${slot + 1}</b> because ${why}.`;
      }
      fr[slot] = p; ld[slot] = t; us[slot] = t;
    }
    out.push({ p, fr: [...fr], hit, slot, ev, why });
  });
  return out;
}

/* ---------- Input handling ---------- */
function showError(m) { $('err').textContent = m; return false; }

function startSimulation() {
  const raw = $('refs').value.trim();
  if (!raw) return showError('Please enter a reference string.');
  // Accepts "7 0 1 2", "7,0,1,2" or "7012"
  const tokens = /^\d+$/.test(raw) ? raw.split('') : raw.split(/[\s,]+/).filter(Boolean);
  if (tokens.some(x => !/^\d+$/.test(x))) return showError('Reference string must contain only non-negative integers.');
  if (tokens.length > 40) return showError('Please use 40 references or fewer.');
  const n = parseInt($('nf').value);
  if (!(n >= 1 && n <= 10)) return showError('Frames must be between 1 and 10.');
  showError('');
  S.refs = tokens.map(Number);
  S.n = n;
  build();
}

function build() {
  stop();
  S.steps = sim(S.algo, S.refs, S.n);
  S.i = 0;
  $('adesc').innerHTML = DESC[S.algo];
  renderComparison();
  render();
}

/* ---------- Rendering ---------- */
function renderComparison() {
  const res = Object.keys(NAMES).map(a => ({ a, f: sim(a, S.refs, S.n).filter(s => !s.hit).length }));
  const min = Math.min(...res.map(x => x.f)), tot = S.refs.length;
  $('cmp').innerHTML = res.map(x => `
    <div class="it ${x.f === min ? 'best' : ''}">
      <span>${NAMES[x.a]}</span>
      <div class="bar"><i style="width:${x.f / tot * 100}%;background:${COLORS[x.a]};color:${COLORS[x.a]}"></i></div>
      <small>${x.f} faults${x.f === min ? '<span class="tag">BEST</span>' : ''}</small>
    </div>`).join('') +
    `<p class="note">Out of ${tot} references with ${S.n} frame${S.n > 1 ? 's' : ''}. Bars show fault rate.</p>`;
}

function render() {
  const { steps, i, n, refs } = S, shown = steps.slice(0, i), cur = i - 1;

  // Timeline table
  let h = '<table><tr><th class="rl">Reference</th>';
  refs.forEach((p, k) => h += `<th class="rf ${k === cur ? 'cur' : ''}" style="${k < i ? '' : 'opacity:.3'}">${p}</th>`);
  h += '</tr>';
  for (let f = 0; f < n; f++) {
    h += `<tr><th class="rl">Frame ${f + 1}</th>`;
    refs.forEach((_, k) => {
      if (k >= i) { h += '<td>·</td>'; return; }
      const s = steps[k], v = s.fr[f];
      let c = v !== null ? 'f' : '';
      if (f === s.slot) c = s.hit ? 'ht' : 'ld';
      else if (k === cur && v !== null) c += ' cur';
      h += `<td class="${c}">${v === null ? '' : v}</td>`;
    });
    h += '</tr>';
  }
  h += '<tr><th class="rl">Result</th>' + refs.map((_, k) => k < i
    ? `<td class="res ${steps[k].hit ? 'H' : 'M'} ${k === cur ? 'cur' : ''}"><span>${steps[k].hit ? 'HIT' : 'MISS'}</span></td>`
    : '<td class="res"></td>').join('') + '</tr></table>';
  const tl = $('tl'), sx = tl.scrollLeft;
  tl.innerHTML = h; tl.scrollLeft = sx;
  if (cur >= 0) {
    const col = tl.querySelector('th.rf.cur');
    if (col) tl.scrollLeft = Math.max(0, col.offsetLeft - tl.clientWidth / 2);
  }

  // Explanation panel
  const ex = $('ex');
  if (cur < 0) {
    ex.innerHTML = '<div class="badge I">READY</div><p>Press <b>Play</b> or <b>Next</b> to start feeding page references into memory.</p>';
  } else {
    const s = steps[cur];
    ex.innerHTML = `<div class="badge ${s.hit ? 'H' : 'M'}">${s.hit ? 'HIT' : 'MISS'}</div><p><b>Step ${i}/${refs.length}.</b> ${s.why}</p>`;
    if (i === refs.length) {
      ex.insertAdjacentHTML('beforeend', `<p style="margin-left:auto;text-align:right;color:var(--mut);font-size:12px">Completed<br><b style="color:var(--txt);font-size:14px">${shown.filter(x => !x.hit).length} faults</b></p>`);
    }
  }

  // Stats
  const hits = shown.filter(s => s.hit).length, faults = i - hits;
  const ratio = i ? faults / i * 100 : 0;
  $('sp').textContent = `${i}/${refs.length}`;
  $('sh').textContent = hits;
  $('sm').textContent = faults;
  $('sr').textContent = ratio.toFixed(1) + '%';
  $('br').style.width = ratio + '%';
  $('bp').style.width = $('pg').style.width = (refs.length ? i / refs.length * 100 : 0) + '%';

  // Log
  $('log').innerHTML = shown.map((s, k) => `
    <div class="${s.hit ? 'H' : 'M'}"><em>#${k + 1}</em><i>${s.hit ? 'HIT' : 'MISS'}</i>
    <span>Page <code>${s.p}</code> → [${s.fr.map(x => x === null ? '–' : x).join(', ')}]${s.ev !== null ? ` · evicted <code>${s.ev}</code>` : ''}</span></div>`
  ).join('') || '<div><span>No steps yet.</span></div>';

  // Buttons
  const done = i >= refs.length;
  $('next').disabled = $('end').disabled = done;
  $('back').disabled = i === 0;
  $('play').innerHTML = S.timer ? '⏸ Pause' : (done ? '↻ Replay' : '▶ Play');
}

/* ---------- Playback ---------- */
function step(d = 1) {
  S.i = Math.max(0, Math.min(S.refs.length, S.i + d));
  if (S.i >= S.refs.length) stop();
  render();
}
function stop() { clearInterval(S.timer); S.timer = null; }
function play() {
  if (S.timer) { stop(); return render(); }
  if (S.i >= S.refs.length) S.i = 0;
  S.timer = setInterval(() => step(1), 1100 - $('speed').value * 100);
  step(1);
}
function reset() { stop(); S.i = 0; render(); }

/* ---------- Events ---------- */

$('refs').oninput = startSimulation;
$('nf').oninput = startSimulation;
$('refs').onkeydown = e => { if (e.key === 'Enter') startSimulation(); };
$('next').onclick = () => { stop(); step(1); };
$('back').onclick = () => { stop(); step(-1); };
$('reset').onclick = reset;
$('end').onclick = () => { stop(); S.i = S.refs.length; render(); };
$('play').onclick = play;
$('speed').oninput = () => { if (S.timer) { stop(); play(); } };
$('rand').onclick = () => {
  const m = 3 + Math.floor(Math.random() * 7), L = 12 + Math.floor(Math.random() * 9);
  $('refs').value = Array.from({ length: L }, () => Math.floor(Math.random() * m)).join(' ');
  startSimulation();
};
document.querySelectorAll('#algo button').forEach(b => b.onclick = () => {
  document.querySelectorAll('#algo button').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  S.algo = b.dataset.a;
  startSimulation();
});
$('presets').innerHTML = Object.keys(PRESETS).map(k => `<span class="chip" data-p="${k}">${k}</span>`).join('');
document.querySelectorAll('.chip').forEach(c => c.onclick = () => { $('refs').value = PRESETS[c.dataset.p]; startSimulation(); });
document.addEventListener('keydown', e => {
  if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
  if (e.code === 'Space') { e.preventDefault(); play(); }
  else if (e.key === 'ArrowRight') { stop(); step(1); }
  else if (e.key === 'ArrowLeft') { stop(); step(-1); }
  else if (e.key.toLowerCase() === 'r') reset();
});

startSimulation();
