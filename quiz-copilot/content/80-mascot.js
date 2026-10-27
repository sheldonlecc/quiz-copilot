/* ============================================================
 * 答题助手 QuizCopilot — 小机器人
 * 待机时眨眼、张望、换表情；可以拖到页面任意位置（位置会记住）
 * 文件：content/80-mascot.js
 * ============================================================ */
(() => {
  const Q = (window.__QC = window.__QC || {});

  const CSS = `
  .qc-bot {
    position: fixed; right: 20px; bottom: 22px; z-index: 2147483646;
    width: 50px; height: 52px; padding: 0; margin: 0;
    border: none; background: transparent; cursor: grab;
    display: flex; align-items: flex-end; justify-content: center;
    font-family: inherit; -webkit-tap-highlight-color: transparent;
    touch-action: none; user-select: none;
  }
  .qc-bot[data-dragging="1"] { cursor: grabbing; }
  .qc-bot[data-dragging="1"] .qc-bot-body { transform: scale(1.06) rotate(-3deg); }

  .qc-bot-body {
    display: flex; flex-direction: column; align-items: center;
    transform-origin: 50% 100%;
    animation: qc-bot-tilt 13s ease-in-out infinite;
    transition: transform .16s ease;
  }
  .qc-bot-antenna {
    position: relative; width: 2px; height: 7px; border-radius: 1px;
    background: rgba(255,255,255,.5); margin-bottom: -1px;
  }
  .qc-bot-antenna::after {
    content: ''; position: absolute; left: 50%; top: -4px;
    transform: translateX(-50%);
    width: 6px; height: 6px; border-radius: 50%;
    background: #7fe3a5; box-shadow: 0 0 7px rgba(127,227,165,.85);
    transition: background .2s, box-shadow .2s;
  }
  .qc-bot-head {
    position: relative;
    width: 38px; height: 34px; border-radius: 12px;
    background: linear-gradient(150deg, #4b86ff, #6b5cf0);
    border: 1px solid rgba(255,255,255,.22);
    box-shadow: 0 6px 18px rgba(59,123,255,.4), inset 0 1px 0 rgba(255,255,255,.26);
    display: flex; align-items: center; justify-content: center;
    animation: qc-bot-breathe 3.6s ease-in-out infinite;
    transition: filter .15s, background .25s, box-shadow .25s;
  }
  .qc-bot:hover .qc-bot-head { filter: brightness(1.08); }
  .qc-bot-eyes {
    display: flex; gap: 8px; margin-top: -2px;
    animation: qc-bot-look 9s ease-in-out infinite;
  }
  .qc-bot-eye {
    width: 6px; height: 9px; border-radius: 3px; background: #fff;
    animation: qc-bot-blink 5.4s ease-in-out infinite;
    transition: width .14s, height .14s, border-radius .14s, background .14s, transform .14s;
  }

  /* ---------- 表情：只靠眼睛和一张小嘴 ---------- */
  .qc-bot[data-mood] .qc-bot-eyes { animation: none; }
  .qc-bot[data-mood] .qc-bot-eye { animation: none; }

  /* 开心：眼睛眯成两道弯 */
  .qc-bot[data-mood="happy"] .qc-bot-eye {
    height: 7px; background: transparent;
    border-top: 2.5px solid #fff; border-radius: 7px 7px 0 0;
  }
  /* 卖萌：一只眯一只睁 */
  .qc-bot[data-mood="wink"] .qc-bot-eye:first-child {
    height: 7px; background: transparent;
    border-top: 2.5px solid #fff; border-radius: 7px 7px 0 0;
  }
  /* 委屈：眼睛又大又圆，外眼角往下垂（八字），配一个撇嘴 */
  .qc-bot[data-mood="sad"] .qc-bot-eye { width: 7px; height: 10px; border-radius: 50%; }
  .qc-bot[data-mood="sad"] .qc-bot-eye:first-child { clip-path: polygon(0 42%, 100% 0, 100% 100%, 0 100%); }
  .qc-bot[data-mood="sad"] .qc-bot-eye:last-child { clip-path: polygon(0 0, 100% 42%, 100% 100%, 0 100%); }
  /* 不高兴：内眼角压下来，眼型更扁，嘴抿成一条线 */
  .qc-bot[data-mood="angry"] .qc-bot-eye { width: 7px; height: 7px; border-radius: 2px; }
  .qc-bot[data-mood="angry"] .qc-bot-eye:first-child { clip-path: polygon(0 0, 100% 45%, 100% 100%, 0 100%); }
  .qc-bot[data-mood="angry"] .qc-bot-eye:last-child { clip-path: polygon(0 45%, 100% 0, 100% 100%, 0 100%); }
  /* 惊讶：又圆又大 */
  .qc-bot[data-mood="surprised"] .qc-bot-eye { width: 7px; height: 11px; border-radius: 50%; }
  /* 困：两条细线 */
  .qc-bot[data-mood="sleepy"] .qc-bot-eye { height: 2.5px; border-radius: 2px; }
  /* 思考：眼珠往上瞟 */
  .qc-bot[data-mood="think"] .qc-bot-eye { transform: translateY(-1.5px); }

  .qc-bot-mouth {
    position: absolute; left: 50%; bottom: 6px;
    width: 9px; height: 4px; margin-left: -4.5px;
    opacity: 0; transition: opacity .16s;
  }
  .qc-bot[data-mood="happy"] .qc-bot-mouth,
  .qc-bot[data-mood="wink"] .qc-bot-mouth,
  .qc-bot[data-mood="sad"] .qc-bot-mouth,
  .qc-bot[data-mood="angry"] .qc-bot-mouth,
  .qc-bot[data-mood="surprised"] .qc-bot-mouth { opacity: 1; }

  .qc-bot[data-mood="happy"] .qc-bot-mouth,
  .qc-bot[data-mood="wink"] .qc-bot-mouth {
    height: 5px; border-bottom: 2px solid #fff; border-radius: 0 0 8px 8px;
  }
  .qc-bot[data-mood="sad"] .qc-bot-mouth {
    height: 4px; border-top: 2px solid #fff; border-radius: 8px 8px 0 0;
  }
  .qc-bot[data-mood="angry"] .qc-bot-mouth {
    width: 7px; height: 2px; margin-left: -3.5px;
    border-top: 2px solid #fff; border-radius: 0;
  }
  .qc-bot[data-mood="surprised"] .qc-bot-mouth {
    width: 5px; height: 5px; margin-left: -2.5px;
    border: 2px solid #fff; border-radius: 50%;
  }

  .qc-bot-tick {
    position: absolute; inset: 0; margin: auto;
    width: 22px; height: 22px; opacity: 0; transition: opacity .12s;
  }
  .qc-bot-tick path {
    fill: none; stroke: #fff; stroke-width: 2.8;
    stroke-linecap: round; stroke-linejoin: round;
    stroke-dasharray: 26; stroke-dashoffset: 26;
  }

  .qc-bot-bubble {
    position: absolute; right: 54px; bottom: 10px;
    max-width: 220px; padding: 6px 10px;
    border-radius: 10px;
    background: #1b1f28; color: #d7dbe2;
    border: 1px solid rgba(255,255,255,.13);
    font-size: 12px; line-height: 1.45; white-space: nowrap;
    box-shadow: 0 6px 20px rgba(0,0,0,.5);
    opacity: 0; transform: translateY(4px) scale(.94);
    transform-origin: 100% 100%;
    transition: opacity .16s ease, transform .16s ease;
    pointer-events: none;
  }
  .qc-bot-bubble[data-show="1"] { opacity: 1; transform: translateY(0) scale(1); }
  .qc-bot-bubble[data-act="1"] {
    pointer-events: auto; cursor: pointer;
    border-color: rgba(127,163,255,.5);
    color: #eaf0ff;
  }
  .qc-bot-bubble[data-act="1"]:hover { background: #232838; }
  .qc-bot-bubble[data-act="1"]::before {
    content: '详情 ';
    color: #8fb2ff; font-size: 11px; letter-spacing: .5px;
  }
  .qc-bot-bubble::after {
    content: ''; position: absolute; right: -5px; bottom: 10px;
    width: 8px; height: 8px; background: #1b1f28;
    border-right: 1px solid rgba(255,255,255,.13);
    border-top: 1px solid rgba(255,255,255,.13);
    transform: rotate(45deg);
  }
  .qc-bot-bubble[data-act="1"]::after { border-color: rgba(127,163,255,.5); }

  @keyframes qc-bot-breathe { 0%, 100% { transform: scale(1) } 50% { transform: scale(1.04) } }
  @keyframes qc-bot-blink { 0%, 93%, 100% { transform: scaleY(1) } 96% { transform: scaleY(.1) } }
  @keyframes qc-bot-look {
    0%, 42% { transform: translateX(0) }
    50%, 58% { transform: translateX(-2px) }
    66%, 74% { transform: translateX(2px) }
    82%, 100% { transform: translateX(0) }
  }
  @keyframes qc-bot-tilt {
    0%, 72%, 100% { transform: rotate(0) }
    78% { transform: rotate(6deg) }
    86% { transform: rotate(-5deg) }
    92% { transform: rotate(0) }
  }
  @keyframes qc-bot-draw { to { stroke-dashoffset: 0 } }
  @keyframes qc-bot-pulse { 0%, 100% { opacity: .35 } 50% { opacity: 1 } }
  @keyframes qc-bot-shake {
    0%, 100% { transform: translateX(0) }
    25% { transform: translateX(-3px) }
    50% { transform: translateX(3px) }
    75% { transform: translateX(-1px) }
  }

  .qc-bot[data-state="thinking"] .qc-bot-head { animation: qc-bot-breathe 1.1s ease-in-out infinite; }
  .qc-bot[data-state="thinking"] .qc-bot-eyes { animation: qc-bot-pulse 1s ease-in-out infinite; }
  .qc-bot[data-state="thinking"] .qc-bot-antenna::after { animation: qc-bot-pulse .7s ease-in-out infinite; }

  .qc-bot[data-state="done"] .qc-bot-head {
    background: linear-gradient(150deg, #34d399, #0f9d63);
    box-shadow: 0 6px 20px rgba(52,211,153,.5), inset 0 1px 0 rgba(255,255,255,.26);
  }
  .qc-bot[data-state="done"] .qc-bot-eyes { opacity: 0; }
  .qc-bot[data-state="done"] .qc-bot-tick { opacity: 1; }
  .qc-bot[data-state="done"] .qc-bot-tick path { animation: qc-bot-draw .42s ease forwards .06s; }

  .qc-bot[data-state="warn"] .qc-bot-head {
    background: linear-gradient(150deg, #f7b955, #b9760f);
    box-shadow: 0 6px 20px rgba(247,185,85,.46), inset 0 1px 0 rgba(255,255,255,.26);
  }
  .qc-bot[data-state="warn"] .qc-bot-eyes { opacity: 0; }
  .qc-bot[data-state="warn"] .qc-bot-tick { opacity: 1; }
  .qc-bot[data-state="warn"] .qc-bot-tick path { animation: qc-bot-draw .42s ease forwards .06s; }

  .qc-bot[data-state="error"] .qc-bot-head {
    background: linear-gradient(150deg, #f87171, #c02a2a);
    box-shadow: 0 6px 20px rgba(248,113,113,.42), inset 0 1px 0 rgba(255,255,255,.2);
  }
  .qc-bot[data-state="error"] .qc-bot-antenna::after { background: #ffb3b3; box-shadow: 0 0 7px rgba(255,120,120,.8); }
  .qc-bot[data-state="error"] .qc-bot-body { animation: qc-bot-shake .42s ease-in-out; }

  @media (prefers-reduced-motion: reduce) {
    .qc-bot-body, .qc-bot-head, .qc-bot-eyes, .qc-bot-eye,
    .qc-bot-antenna::after, .qc-bot-tick path { animation: none !important; }
    .qc-bot[data-state="done"] .qc-bot-tick path,
    .qc-bot[data-state="warn"] .qc-bot-tick path { stroke-dashoffset: 0; }
  }
  `;

  /* 待机时随机换的表情（权重加起来 0.52，剩下 48% 就是单纯眨个眼） */
  const IDLE_MOODS = [
    { k: 'happy', ms: 1200, w: 0.22 },
    { k: 'wink', ms: 900, w: 0.12 },
    { k: 'sad', ms: 1100, w: 0.1 },
    { k: 'surprised', ms: 800, w: 0.08 }
  ];

  let el = null;
  let bubbleTimer = null;
  let idleTimer = null;
  let moodTimer = null;
  let sleepTimer = null;
  let drag = null;
  let suppressClick = false;

  function ensureStyle(shadow) {
    if (shadow.querySelector('style[data-qc-style="mascot"]')) return;
    const st = document.createElement('style');
    st.setAttribute('data-qc-style', 'mascot');
    st.textContent = CSS;
    shadow.appendChild(st);
  }

  function prefersReduced() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) {
      return false;
    }
  }

  /* ---------- 位置 ---------- */
  function clampPos(left, top) {
    const w = el.offsetWidth || 50;
    const h = el.offsetHeight || 52;
    const maxL = Math.max(4, window.innerWidth - w - 4);
    const maxT = Math.max(4, window.innerHeight - h - 4);
    return {
      left: Math.min(Math.max(4, left), maxL),
      top: Math.min(Math.max(4, top), maxT)
    };
  }

  function moveTo(left, top) {
    if (!el) return;
    const p = clampPos(left, top);
    el.style.left = p.left + 'px';
    el.style.top = p.top + 'px';
    el.style.right = 'auto';
    el.style.bottom = 'auto';
  }

  function savePos() {
    if (!el) return;
    const r = el.getBoundingClientRect();
    try {
      chrome.storage.sync.set({ botPos: { left: Math.round(r.left), top: Math.round(r.top) } });
    } catch (e) {}
  }

  function restorePos() {
    try {
      chrome.storage.sync.get({ botPos: null }, (cfg) => {
        const p = cfg && cfg.botPos;
        if (!el || !p) return;
        if (typeof p.left === 'number' && typeof p.top === 'number') moveTo(p.left, p.top);
      });
    } catch (e) {}
  }

  function onResize() {
    if (!el || !el.style.left) return;
    const r = el.getBoundingClientRect();
    moveTo(r.left, r.top);
  }

  /* ---------- 拖拽 ---------- */
  function onDown(e) {
    if (!el) return;
    if (e.button != null && e.button !== 0) return;
    if (e.target && e.target.closest && e.target.closest('.qc-bot-bubble')) return;

    const r = el.getBoundingClientRect();
    drag = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      ox: e.clientX - r.left,
      oy: e.clientY - r.top,
      moved: false
    };
    try {
      el.setPointerCapture(e.pointerId);
    } catch (err) {}
  }

  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    drag.moved = true;
    el.dataset.dragging = '1';
    moveTo(e.clientX - drag.ox, e.clientY - drag.oy);
  }

  function onUp(e) {
    if (!drag || (e.pointerId != null && e.pointerId !== drag.id)) return;
    const moved = drag.moved;
    drag = null;
    if (el) delete el.dataset.dragging;
    try {
      el.releasePointerCapture(e.pointerId);
    } catch (err) {}

    if (!moved) return;
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 80);
    savePos();
    if (el) {
      setMood('happy', 900);
      say('放这儿啦', 1400, false);
    }
  }

  /* ---------- 悬停 ---------- */
  function onEnter() {
    if (!el) return;
    if (el.dataset.state === 'idle' && !bubbleTimer) say('点我一键解题', 0, false);
    if (el.dataset.state === 'idle' && !el.dataset.mood) setMood('happy', 1400);
  }

  function onLeave() {
    if (!el) return;
    if (el.dataset.state !== 'idle') return;
    if (!bubbleTimer) say('', 0, false);
    if (el.dataset.mood === 'happy') clearMood();
  }

  /* ---------- 待机小动作 ---------- */
  function pickMood() {
    const r = Math.random();
    let acc = 0;
    for (const m of IDLE_MOODS) {
      acc += m.w;
      if (r < acc) return m;
    }
    return null;
  }

  function startIdle() {
    stopIdle();
    if (prefersReduced()) return;
    idleTimer = setInterval(() => {
      if (!el || el.dataset.state !== 'idle' || el.dataset.mood || drag) return;
      const m = pickMood();
      if (m) setMood(m.k, m.ms);
    }, 5200);
    sleepTimer = setTimeout(() => {
      if (el && el.dataset.state === 'idle' && !el.dataset.mood) setMood('sleepy', 0);
    }, 50000);
  }

  function stopIdle() {
    if (idleTimer) { clearInterval(idleTimer); idleTimer = null; }
    if (sleepTimer) { clearTimeout(sleepTimer); sleepTimer = null; }
  }

  /* ---------- 表情 ---------- */
  function clearMood() {
    if (!el) return;
    if (moodTimer) { clearTimeout(moodTimer); moodTimer = null; }
    delete el.dataset.mood;
  }

  /* ms = 0 表示一直保持，直到下次显式切换 */
  function setMood(name, ms) {
    if (!el || !name) return;
    if (moodTimer) { clearTimeout(moodTimer); moodTimer = null; }
    el.dataset.mood = name;
    if (ms) {
      moodTimer = setTimeout(() => {
        moodTimer = null;
        if (el && el.dataset.state === 'idle') clearMood();
      }, ms);
    }
  }

  /* ---------- 构建 ---------- */
  function mount() {
    const S = Q.S;
    if (!S || S.showFab === false) return null;
    Q.ensureHost();
    const shadow = S.shadow;
    if (!shadow) return null;
    ensureStyle(shadow);
    if (el && el.isConnected) return el;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'qc-bot';
    btn.dataset.state = 'idle';
    btn.title = '点我：读题 → 作答 → 填入；按住可以拖到别处';
    btn.innerHTML =
      '<span class="qc-bot-body">' +
      '<span class="qc-bot-antenna"></span>' +
      '<span class="qc-bot-head">' +
      '<span class="qc-bot-eyes"><span class="qc-bot-eye"></span><span class="qc-bot-eye"></span></span>' +
      '<span class="qc-bot-mouth"></span>' +
      '<svg class="qc-bot-tick" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 12.5 L10 17 L18.5 7.5"/></svg>' +
      '</span></span>' +
      '<span class="qc-bot-bubble"></span>';

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (suppressClick) return;
      if (Q.oneKeyFlow) Q.oneKeyFlow({ from: 'mascot' });
    });
    btn.addEventListener('mouseenter', onEnter);
    btn.addEventListener('mouseleave', onLeave);
    btn.addEventListener('pointerdown', onDown);
    btn.addEventListener('pointermove', onMove);
    btn.addEventListener('pointerup', onUp);
    btn.addEventListener('pointercancel', onUp);

    const bubble = btn.querySelector('.qc-bot-bubble');
    bubble.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (bubble.dataset.act !== '1') return;
      if (Q.openPanel) Q.openPanel();
      if (Q.render) Q.render();
    });

    shadow.appendChild(btn);
    el = btn;

    try {
      window.addEventListener('resize', onResize, { passive: true });
    } catch (e) {}

    restorePos();
    startIdle();
    return el;
  }

  function getState() {
    return el ? el.dataset.state : 'idle';
  }

  function setState(state) {
    if (!el) return;
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
    el.dataset.state = state;

    if (state === 'idle') {
      clearMood();
      startIdle();
      return;
    }
    stopIdle();
    if (state === 'error') setMood('sad', 0);
    else clearMood();
  }

  /**
   * say(text, ms, clickable)
   * clickable = true 时气泡可点击，点开面板看详情
   */
  function say(text, ms, clickable) {
    if (!el) return;
    const b = el.querySelector('.qc-bot-bubble');
    if (!b) return;
    if (bubbleTimer) {
      clearTimeout(bubbleTimer);
      bubbleTimer = null;
    }
    b.textContent = text || '';
    b.dataset.show = text ? '1' : '0';
    b.dataset.act = text && clickable ? '1' : '0';
    if (text && ms !== 0) {
      bubbleTimer = setTimeout(() => {
        b.dataset.show = '0';
        b.dataset.act = '0';
        bubbleTimer = null;
      }, ms || 2800);
    }
  }

  /* 走完流程后自动回待机；可点的「详情」气泡留着，等用户自己点 */
  function settleAfter(ms) {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (el && (el.dataset.state === 'done' || el.dataset.state === 'warn' || el.dataset.state === 'error')) {
        el.dataset.state = 'idle';
        clearMood();
        const b = el.querySelector('.qc-bot-bubble');
        if (b && b.dataset.act !== '1') say('', 0, false);
        startIdle();
      }
      idleTimer = null;
    }, ms || 2600);
  }

  function show(visible) {
    if (!el) return;
    el.style.display = visible ? 'flex' : 'none';
  }

  function destroy() {
    stopIdle();
    clearMood();
    try {
      window.removeEventListener('resize', onResize);
    } catch (e) {}
    drag = null;
    if (el && el.isConnected) el.remove();
    el = null;
  }

  Q.mascot = { mount, getState, setState, setMood, say, settleAfter, show, destroy, moveTo, CSS };
})();
