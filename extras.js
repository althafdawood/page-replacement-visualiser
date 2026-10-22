/* extras.js: Clock algorithm, Faults-vs-Frames chart, Belady demo, Predict-the-victim quiz.
   Load AFTER script.js:  <script src="script.js"></script><script src="extras.js"></script> */
(function () {
  const BEL = '1 2 3 4 1 2 5 1 2 3 4 5';
  const code = x => `<code>${x}</code>`;

  /* ---------- 1. Simulation with Clock added ---------- */
  /*SIM_START*/
  window.sim = function (algo, refs, n) {
    const fr = Array(n).fill(null), ld = Array(n).fill(0), us = Array(n).fill(0), rb = Array(n).fill(0), out = [];
    let hand = 0;
    refs.forEach((p, t) => {
      const at = fr.indexOf(p), hit = at > -1;
      let slot = at, ev = null, why = '';
      if (hit) {
        us[at] = t; rb[at] = 1;
        why = `Page ${code(p)} is already in <b>Frame ${at + 1}</b>, so no memory fetch is needed.` + (algo === 'CLOCK' ? ' Its reference bit is set to 1.' : '');
      } else {
        const e = fr.indexOf(null);
        if (e > -1) {
          slot = e; hand = (e + 1) % n;
          why = `Page ${code(p)} is not in memory. <b>Frame ${e + 1}</b> is empty, so it is loaded there with nothing evicted.`;
        } else {
          let r;
          if (algo === 'FIFO') { slot = ld.indexOf(Math.min(...ld)); r = 'it entered memory earliest (first in)'; }
          else if (algo === 'LRU') { slot = us.indexOf(Math.min(...us)); r = 'it was used least recently'; }
          else if (algo === 'OPT') {
            const nx = fr.map(x => { const k = refs.indexOf(x, t + 1); return k < 0 ? Infinity : k; });
            slot = nx.indexOf(Math.max(...nx));
            r = nx[slot] === Infinity ? 'it is never referenced again' : `its next use is farthest away (at position ${nx[slot] + 1})`;
          } else {
            const sk = [];
            while (rb[hand]) { sk.push(fr[hand]); rb[hand] = 0; hand = (hand + 1) % n; }
            slot = hand; hand = (hand + 1) % n;
            r = sk.length ? `the clock hand gave ${sk.map(code).join(', ')} a second chance (reference bit cleared) and stopped at a page with bit 0` : 'the page under the clock hand has reference bit 0';
          }
          ev = fr[slot];
          why = `Page ${code(p)} is not in memory and all frames are full. Evicting ${code(ev)} from <b>Frame ${slot + 1}</b> because ${r}.`;
        }
        fr[slot] = p; ld[slot] = t; us[slot] = t; rb[slot] = 1;
      }
      out.push({ p, fr: [...fr], hit, slot, ev, why, rb: [...rb], hand });
    });
    return out;
  };
  /*SIM_END*/

  NAMES.CLOCK = 'Clock'; COLORS.CLOCK = 'var(--miss)';
  DESC.CLOCK = '<b style="color:var(--txt)">Clock (Second Chance).</b> Frames form a circle with a hand. A page with reference bit 1 gets a second chance (bit cleared); the first page with bit 0 is evicted. Cheap approximation of LRU used in real systems.';
  const seg = $('algo'), cb = document.createElement('button');
  cb.dataset.a = 'CLOCK'; cb.textContent = 'Clock';
  cb.onclick = () => { seg.querySelectorAll('button').forEach(x => x.classList.remove('on')); cb.classList.add('on'); S.algo = 'CLOCK'; startSimulation(); };
  seg.appendChild(cb);

  /* ---------- styles ---------- */
  const st = document.createElement('style');
  st.textContent = `
  .tg{display:flex;gap:10px;align-items:center;font-size:13px;color:var(--txt);margin:14px 0 0;cursor:pointer}
  .tg input{accent-color:var(--acc);width:16px;height:16px}
  .qs{font:700 13px var(--mono);color:var(--acc);margin-top:8px;min-height:16px}
  .quiz{display:none;margin-bottom:14px;padding:14px 16px;border-radius:12px;background:var(--bg);border:1px solid var(--acc);font-size:14px;line-height:1.6}
  .quiz.ok{border-color:var(--hit)}.quiz.bad{border-color:var(--miss)}
  .quiz code{font-family:var(--mono);background:var(--panel2);padding:1px 7px;border-radius:6px;font-weight:700}
  .qopts{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
  .clk{display:none;gap:18px;align-items:center;margin-top:14px;padding:12px 16px;border-radius:12px;background:var(--bg);border:1px solid var(--line);font-size:13px;color:var(--mut);line-height:1.6}
  .belb{display:none;margin-bottom:18px;border-color:var(--miss)}
  .belb .rw{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}
  .belb .ch{padding:10px 14px;border-radius:10px;background:var(--bg);border:1px solid var(--line);font:600 13px var(--mono)}
  .belb .ch.bad{border-color:var(--miss);color:var(--miss)}.belb .ch.good{border-color:var(--hit);color:var(--hit)}
  .leg{display:flex;gap:16px;flex-wrap:wrap;margin-top:8px;font-size:12px;color:var(--mut)}
  .leg i{display:inline-block;width:18px;height:4px;border-radius:3px;margin-right:6px;vertical-align:middle}`;
  document.head.appendChild(st);

  /* ---------- UI injection ---------- */
  const main = document.querySelector('.main') || document.querySelector('.wrap') || document.body;
  const side = document.querySelector('.side') || main;
  const mk = (tag, cls, html, id) => { const d = document.createElement(tag); if (cls) d.className = cls; if (id) d.id = id; d.innerHTML = html; return d; };
  side.appendChild(mk('div', 'card', `<h2>Extras</h2>
    <button class="btn wide" id="belBtn">⚡ Demo Belady's anomaly</button>
    <label class="tg"><input type="checkbox" id="qz"> Predict the victim (quiz mode)</label>
    <div class="qs" id="qscore"></div>`));
  main.appendChild(mk('div', 'card belb', '', 'belb'));
  main.appendChild(mk('div', 'card', `<h2>Faults vs Number of Frames (all algorithms, current reference string)</h2><div id="curve"></div><div class="leg" id="cleg"></div>`, 'curves'));
  $('ex').before(mk('div', 'quiz', '', 'quiz'));

  /* ---------- 2. Faults vs frames chart ---------- */
  function drawCurves() {
    const W = 640, H = 270, L = 42, R = 18, T = 16, B = 36, MX = 8, tot = S.refs.length, al = Object.keys(NAMES);
    const X = n => L + (n - 1) * (W - L - R) / (MX - 1), Y = v => T + (H - T - B) * (1 - v / tot);
    let g = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto">`;
    [0, .25, .5, .75, 1].forEach(f => { const v = Math.round(tot * f); g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" style="stroke:var(--line)"/><text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end" style="fill:var(--mut);font:11px var(--mono)">${v}</text>`; });
    for (let n = 1; n <= MX; n++) g += `<text x="${X(n)}" y="${H - 14}" text-anchor="middle" style="fill:var(--mut);font:11px var(--mono)">${n}</text>`;
    g += `<text x="${(L + W - R) / 2}" y="${H - 1}" text-anchor="middle" style="fill:var(--mut);font:11px Inter">frames</text>`;
    if (S.n <= MX) g += `<line x1="${X(S.n)}" x2="${X(S.n)}" y1="${T}" y2="${H - B}" style="stroke:var(--acc);stroke-dasharray:4 4"/>`;
    al.forEach(a => {
      const pts = []; for (let n = 1; n <= MX; n++) pts.push([n, sim(a, S.refs, n).filter(s => !s.hit).length]);
      g += `<polyline fill="none" style="stroke:${COLORS[a]};stroke-width:2.5" points="${pts.map(p => X(p[0]) + ',' + Y(p[1])).join(' ')}"/>`;
      pts.forEach(p => g += `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="4" style="fill:${COLORS[a]}"><title>${NAMES[a]}, ${p[0]} frames: ${p[1]} faults</title></circle>`);
    });
    $('curve').innerHTML = g + '</svg>';
    $('cleg').innerHTML = al.map(a => `<span><i style="background:${COLORS[a]}"></i>${NAMES[a]}</span>`).join('') + '<span>Dashed line = current frame count</span>';
  }

  /* ---------- 3. Belady demo ---------- */
  const faults = (a, n) => sim(a, S.refs, n).filter(s => !s.hit).length;
  function bel() {
    const b = $('belb');
    if (S.refs.join(' ') !== BEL) { b.style.display = 'none'; return; }
    const chips = Object.keys(NAMES).map(a => { const f3 = faults(a, 3), f4 = faults(a, 4), bad = f4 > f3;
      return `<div class="ch ${bad ? 'bad' : 'good'}">${NAMES[a]}: ${f3} → ${f4} faults ${bad ? '⚠ anomaly' : '✓'}</div>`; }).join('');
    b.innerHTML = `<h2>Belady's anomaly</h2><p style="font-size:14px;line-height:1.6">On this string, giving FIFO <b>more</b> memory (3 → 4 frames) makes it fault <b>more</b>. Stack algorithms such as LRU and Optimal never do this.</p><div class="rw">${chips}</div>
    <div class="rw"><button class="btn" id="b3">Show 3 frames</button><button class="btn pri" id="b4">Show 4 frames</button></div>`;
    b.style.display = 'block';
    $('b3').onclick = () => { $('nf').value = 3; startSimulation(); };
    $('b4').onclick = () => { $('nf').value = 4; startSimulation(); };
  }
  $('belBtn').onclick = () => {
    $('refs').value = BEL; $('nf').value = 3;
    seg.querySelector('[data-a="FIFO"]').click();
    $('belb').scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  /* ---------- Clock dial ---------- */
  function drawClock() {
    let c = $('clk');
    if (!c) { c = mk('div', 'clk', '', 'clk'); $('ex').after(c); }
    if (S.algo !== 'CLOCK' || S.i < 1) { c.style.display = 'none'; return; }
    const s = S.steps[S.i - 1], n = S.n, R = 70, cx = 110, cy = 100;
    const pos = k => { const a = (-90 + k * 360 / n) * Math.PI / 180; return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; };
    const [hx, hy] = pos(s.hand);
    let g = `<svg viewBox="0 0 220 200" width="220" height="200"><circle cx="${cx}" cy="${cy}" r="${R}" fill="none" style="stroke:var(--line);stroke-dasharray:4 4"/>`;
    for (let k = 0; k < n; k++) {
      const [x, y] = pos(k), on = s.rb[k];
      g += `<circle cx="${x}" cy="${y}" r="22" style="fill:${on ? '#34d3991f' : 'var(--panel2)'};stroke:${on ? 'var(--hit)' : 'var(--line)'};stroke-width:2"/>
      <text x="${x}" y="${y}" text-anchor="middle" style="fill:var(--txt);font:700 15px var(--mono)">${s.fr[k] === null ? '' : s.fr[k]}</text>
      <text x="${x}" y="${y + 14}" text-anchor="middle" style="fill:var(--mut);font:600 9px var(--mono)">R=${on}</text>`;
    }
    g += `<line x1="${cx}" y1="${cy}" x2="${cx + (hx - cx) * .6}" y2="${cy + (hy - cy) * .6}" style="stroke:var(--acc);stroke-width:4;stroke-linecap:round"/><circle cx="${cx}" cy="${cy}" r="6" style="fill:var(--acc)"/></svg>`;
    c.innerHTML = g + `<div><b style="color:var(--txt)">Clock state after step ${S.i}</b><br>The hand points at <b style="color:var(--acc)">Frame ${s.hand + 1}</b>, the next frame to be examined.<br>Green = reference bit 1 (gets a second chance). Grey = bit 0 (can be evicted).</div>`;
    c.style.display = 'flex';
  }

  /* ---------- 5. Predict-the-victim quiz ---------- */
  const _step = step, _render = render, _build = build;
  let qOn = false, pend = -1, qs = { c: 0, t: 0 };
  const scoreUI = () => { $('qscore').textContent = qOn ? `Score: ${qs.c}/${qs.t}` : ''; };
  const hideQ = () => { $('quiz').style.display = 'none'; };
  $('qz').onchange = e => { qOn = e.target.checked; qs = { c: 0, t: 0 }; pend = -1; hideQ(); scoreUI(); };
  function ask(i) {
    const stp = S.steps[i], prev = S.steps[i - 1].fr, q = $('quiz');
    pend = i; q.className = 'quiz'; q.style.display = 'block';
    q.innerHTML = `<b>Your turn:</b> page ${code(stp.p)} is requested and memory is full. Which page will <b>${NAMES[S.algo]}</b> evict?<div class="qopts">${prev.map((v, k) => `<button class="btn" data-v="${v}">Frame ${k + 1}: page ${v}</button>`).join('')}</div>`;
    q.querySelectorAll('button').forEach(b => b.onclick = () => answer(i, +b.dataset.v));
  }
  function answer(i, v) {
    const real = S.steps[i].ev, ok = v === real;
    qs.t++; if (ok) qs.c++; scoreUI(); pend = -1;
    _step(1);
    const q = $('quiz'); q.className = 'quiz ' + (ok ? 'ok' : 'bad'); q.style.display = 'block';
    q.innerHTML = ok ? `✔ Correct! Page ${code(real)} was evicted.` : `✘ Not quite. You chose ${code(v)}, but ${NAMES[S.algo]} evicted ${code(real)}. The explanation is shown below.`;
  }
  window.step = function (d = 1) {
    if (qOn && d === 1 && S.i < S.steps.length && S.steps[S.i].ev !== null) { stop(); ask(S.i); _render(); return; }
    hideQ(); _step(d);
  };
  window.render = function () {
    _render(); drawClock();
    if (pend >= 0 && S.i !== pend) { pend = -1; hideQ(); }
  };
  window.build = function () { pend = -1; hideQ(); qs = { c: 0, t: 0 }; scoreUI(); _build(); drawCurves(); bel(); drawClock(); };

  build();
})();
