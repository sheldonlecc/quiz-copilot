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
  .qc-bot:active .qc-bot-body { transform: scale(.93); }

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
    display: flex; gap: 8px;
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

  /* 开心：眼睛眯成两道半圆（高度约为正常眼的一半） */
  .qc-bot[data-mood="happy"] .qc-bot-eye {
    width: 8px; height: 4.5px; background: transparent;
    border-top: 2.5px solid #fff; border-radius: 4.5px 4.5px 0 0;
    transform: translateY(1.5px);
  }
  /* 卖萌：一只半圆一只睁 */
  .qc-bot[data-mood="wink"] .qc-bot-eye:first-child {
    width: 8px; height: 4.5px; background: transparent;
    border-top: 2.5px solid #fff; border-radius: 4.5px 4.5px 0 0;
    transform: translateY(1.5px);
  }
  /* 委屈：眼睛又大又圆，外眼角往下垂（八字），配一个撇嘴 */
  .qc-bot[data-mood="sad"] .qc-bot-eye { width: 7px; height: 10px; border-radius: 50%; }
  .qc-bot[data-mood="sad"] .qc-bot-eye:first-child { clip-path: polygon(0 42%, 100% 0, 100% 100%, 0 100%); }
  .qc-bot[data-mood="sad"] .qc-bot-eye:last-child { clip-path: polygon(0 0, 100% 42%, 100% 100%, 0 100%); }
  /* 不高兴：内眼角压下来，眼型更扁，嘴抿成一条线 */
  .qc-bot[data-mood="angry"] .qc-bot-eye { width: 7px; height: 7px; border-radius: 2px; }
  .qc-bot[data-mood="angry"] .qc-bot-eye:first-child { clip-path: polygon(0 0, 100% 45%, 100% 100%, 0 100%); }
  .qc-bot[data-mood="angry"] .qc-bot-eye:last-child { clip-path: polygon(0 45%, 100% 0, 100% 100%, 0 100%); }
  /* 惊讶：眼睛瞪得又圆又大 */
  .qc-bot[data-mood="surprised"] .qc-bot-eye { width: 8px; height: 12px; border-radius: 50%; }
  /* 困：两条细线 */
  .qc-bot[data-mood="sleepy"] .qc-bot-eye { height: 2.5px; border-radius: 2px; }
  /* 思考：眼珠往上瞟 */
  .qc-bot[data-mood="think"] .qc-bot-eye { transform: translateY(-1.5px); }

  /* 鼠标靠近：眼睛跟着走 */
  .qc-bot[data-tracking="1"] .qc-bot-eyes {
    animation: none;
    transform: translate(var(--qc-look-x, 0px), var(--qc-look-y, 0px));
  }

  /* 晕：两只螺旋眼各转各的，整只轻轻摇 */
  .qc-bot-spiral {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center; gap: 7px;
    opacity: 0; pointer-events: none;
  }
  .qc-bot-spiral svg {
    width: 10px; height: 10px; display: block;
    transform-origin: 50% 50%;
  }
  .qc-bot-spiral path {
    fill: none; stroke: #fff; stroke-width: 1.25;
    stroke-linecap: round; stroke-linejoin: round;
  }
  .qc-bot[data-mood="dizzy"] .qc-bot-eyes { opacity: 0; }
  .qc-bot[data-mood="dizzy"] .qc-bot-spiral { opacity: 1; }
  .qc-bot[data-mood="dizzy"] .qc-bot-spiral svg { animation: qc-bot-dizzy 1.1s linear infinite; }
  /* 松手后靠惯性慢慢转，越转越慢 */
  .qc-bot[data-mood="dizzy"][data-spin="slow"] .qc-bot-spiral svg { animation-duration: 2.4s; }
  .qc-bot[data-mood="dizzy"] .qc-bot-body { animation: qc-bot-wobble 1.1s ease-in-out infinite; }

  /* 晕完：眼睛闭成 > <，原地甩甩头 */
  .qc-bot[data-mood="daze"] .qc-bot-eye {
    width: 6px; height: 6px; border-radius: 0; background: transparent;
    border-top: 2px solid #fff; border-right: 2px solid #fff;
    transform: rotate(45deg);
  }
  .qc-bot[data-mood="daze"] .qc-bot-eye:last-child {
    border-right: 0; border-left: 2px solid #fff;
    transform: rotate(-45deg);
  }
  /* 甩头不转脑袋，靠两只眼睛整体左右荡来表现 */
  .qc-bot[data-mood="daze"] .qc-bot-eyes { animation: qc-bot-eyeshake .42s ease-in-out infinite; }

  /* 双击 / 无聊时蹦一下 */
  .qc-bot[data-hop="1"] .qc-bot-body { animation: qc-bot-hop .52s cubic-bezier(.3,.8,.4,1); }

  /* 打瞌睡时头上飘 z z z */
  .qc-bot-zzz {
    position: absolute; right: -14px; top: -16px;
    width: 26px; height: 28px;
    opacity: 0; pointer-events: none;
    transition: opacity .25s;
  }
  .qc-bot[data-mood="sleepy"] .qc-bot-zzz { opacity: 1; }
  .qc-bot-zzz i {
    position: absolute; left: 0; bottom: 0;
    font-style: normal; font-weight: 700; line-height: 1;
    color: #eef4ff; text-shadow: 0 0 7px rgba(150,180,255,.95);
    opacity: 0;
  }
  .qc-bot-zzz i:nth-child(1) { font-size: 9px; }
  .qc-bot-zzz i:nth-child(2) { font-size: 12px; left: 5px; }
  .qc-bot-zzz i:nth-child(3) { font-size: 15px; left: 10px; }
  .qc-bot[data-mood="sleepy"] .qc-bot-zzz i { animation: qc-bot-zzz 1.9s ease-out infinite; }
  .qc-bot[data-mood="sleepy"] .qc-bot-zzz i:nth-child(1) { animation-delay: 0s; }
  .qc-bot[data-mood="sleepy"] .qc-bot-zzz i:nth-child(2) { animation-delay: .45s; }
  .qc-bot[data-mood="sleepy"] .qc-bot-zzz i:nth-child(3) { animation-delay: .9s; }

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
  @keyframes qc-bot-zzz {
    0% { opacity: 0; transform: translate(0, 2px) scale(.7) }
    16% { opacity: 1 }
    68% { opacity: .95 }
    100% { opacity: 0; transform: translate(10px, -16px) scale(1.05) }
  }
  @keyframes qc-bot-dizzy { to { transform: rotate(360deg) } }
  @keyframes qc-bot-eyeshake {
    0%, 100% { transform: translateX(0) }
    15% { transform: translateX(-3px) }
    45% { transform: translateX(3px) }
    72% { transform: translateX(-1.5px) }
    88% { transform: translateX(.8px) }
  }
  @keyframes qc-bot-wobble {
    0%, 100% { transform: rotate(0) }
    25% { transform: rotate(-6deg) }
    75% { transform: rotate(6deg) }
  }
  @keyframes qc-bot-hop {
    0% { transform: translateY(0) scale(1, 1) }
    16% { transform: translateY(3px) scale(1.14, .86) }
    44% { transform: translateY(-13px) scale(.93, 1.09) }
    70% { transform: translateY(0) scale(1.1, .9) }
    86% { transform: translateY(0) scale(.98, 1.02) }
    100% { transform: translateY(0) scale(1, 1) }
  }
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
    .qc-bot-antenna::after, .qc-bot-tick path, .qc-bot-zzz i,
    .qc-bot-spiral, .qc-bot-spiral svg { animation: none !important; }
    .qc-bot[data-state="done"] .qc-bot-tick path,
    .qc-bot[data-state="warn"] .qc-bot-tick path { stroke-dashoffset: 0; }
    .qc-bot[data-mood="sleepy"] .qc-bot-zzz i { opacity: .92; }
    .qc-bot-zzz i:nth-child(1) { bottom: 0; }
    .qc-bot-zzz i:nth-child(2) { bottom: 7px; }
    .qc-bot-zzz i:nth-child(3) { bottom: 15px; }
  }
  `;

  /* 晕眩用的螺旋线（10×10 的 viewBox 里绕 2.2 圈） */
  const SPIRAL =
    'M5.0 4.6L5.2 4.5L5.4 4.5L5.6 4.7L5.8 4.9L5.9 5.2L5.8 5.6L5.6 5.9L5.3 6.2L4.8 6.3L4.3 6.3' +
    'L3.8 6.0L3.4 5.6L3.2 5.0L3.3 4.3L3.5 3.7L4.1 3.1L4.8 2.8L5.6 2.8L6.4 3.1L7.1 3.6L7.6 4.4' +
    'L7.7 5.4L7.5 6.4L6.9 7.2L6.0 7.9L4.9 8.1L3.7 8.0L2.7 7.4L1.9 6.5L1.5 5.3L1.5 4.0L2.0 2.7' +
    'L2.9 1.7L4.2 1.1L5.7 1.0L7.1 1.4L8.3 2.3L9.2 3.6';

  /* 交互参数 */
  const FOLLOW_R = 220;      // 鼠标进入这个半径，眼睛开始跟
  const WAKE_R = 150;        // 睡着的它，鼠标走到这么近会惊醒
  const DIZZY_SPEED = 1200;  // 拖动速度超过这个值（px/s）会晕
  const DIZZY_WINDOW = 1600; // 判定画圈的时间窗
  const DOUBLE_MS = 280;     // 两次点击间隔小于它算双击
  const TAP_CHAIN_MS = 520;  // 这个时间内接着点，算同一串连击
  const TAP_GAP_MS = 220;    // 双击先等这么久，确认不是三击
  const DIZZY_INERTIA = 1100; // 松手后靠惯性继续晕多久
  const DAZE_MS = 950;       // 闭眼甩头的时长

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

  let rafId = 0;
  let lastPtr = null;
  let tracking = false;
  let dragSamples = [];
  let dizzyUntil = 0;
  let pokeTimes = [];
  let hopTimer = null;
  let wanderTimer = null;
  let clickTimer = null;
  let doubleTimer = null;
  let settleTimer = null;
  let dizzySettle = null;
  let dizzyFallback = null;
  let tapCount = 0;
  let doublePlayed = false;
  let lastTapAt = 0;

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

  /* ---------- 松手贴边 ---------- */
  function snapToEdge() {
    if (!el) return;
    const r = el.getBoundingClientRect();
    const M = 12;
    let left = r.left;
    let top = r.top;
    if (r.left < M) left = 4;
    else if (window.innerWidth - r.right < M) left = window.innerWidth - r.width - 4;
    if (r.top < M) top = 4;
    else if (window.innerHeight - r.bottom < M) top = window.innerHeight - r.height - 4;

    if (Math.round(left) === Math.round(r.left) && Math.round(top) === Math.round(r.top)) return;

    el.style.transition = 'left .18s ease, top .18s ease';
    moveTo(left, top);
    setTimeout(() => {
      if (el) el.style.transition = '';
    }, 220);
    setTimeout(savePos, 200);
  }

  /* ---------- 鼠标靠近：眼睛跟着走 ---------- */
  function stopFollow() {
    tracking = false;
    if (el && el.dataset.tracking) delete el.dataset.tracking;
  }

  function wake() {
    if (!el || el.dataset.mood !== 'sleepy') return;
    setMood('surprised', 450);
    say('！', 700, false);
    startIdle();
  }

  function tick() {
    if (!el) return;
    if (el.dataset.state !== 'idle' || drag) {
      stopFollow();
      return;
    }
    if (!lastPtr) return;

    const box = el.getBoundingClientRect();
    const dx = lastPtr.x - (box.left + box.width / 2);
    const dy = lastPtr.y - (box.top + box.height / 2);
    const dist = Math.hypot(dx, dy);

    if (el.dataset.mood === 'sleepy' && dist < WAKE_R) wake();

    if (dist > FOLLOW_R || el.dataset.mood) {
      stopFollow();
      return;
    }

    const nx = Math.max(-1, Math.min(1, dx / FOLLOW_R));
    const ny = Math.max(-1, Math.min(1, dy / FOLLOW_R));
    el.dataset.tracking = '1';
    el.style.setProperty('--qc-look-x', (nx * 1.8).toFixed(1) + 'px');
    el.style.setProperty('--qc-look-y', (ny * 1.4).toFixed(1) + 'px');
    tracking = true;
  }

  function onWindowMove(e) {
    lastPtr = { x: e.clientX, y: e.clientY };
    if (typeof requestAnimationFrame !== 'function') {
      tick();
      return;
    }
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      tick();
    });
  }

  /* ---------- 晕 ---------- */
  function makeDizzy() {
    const now = Date.now();
    if (now < dizzyUntil) return;
    dizzyUntil = now + 4200;
    dragSamples = [];
    if (el) delete el.dataset.spin;
    // 不用定时器收尾：等松手后走「惯性 → 闭眼甩头 → 待机」
    setMood('dizzy', 0);
    say('晕…', 1500, false);
    if (dizzyFallback) clearTimeout(dizzyFallback);
    dizzyFallback = setTimeout(() => {
      dizzyFallback = null;
      if (el && el.dataset.mood === 'dizzy') runDizzyOut();
    }, 6000);
  }

  /* 松手：螺旋先慢慢转一会儿（惯性），再闭眼甩头 */
  function settleDizzy() {
    if (!el || el.dataset.mood !== 'dizzy') return;
    el.dataset.spin = 'slow';
    if (dizzySettle) clearTimeout(dizzySettle);
    dizzySettle = setTimeout(() => {
      dizzySettle = null;
      runDizzyOut();
    }, DIZZY_INERTIA);
  }

  /* 收场：眼睛闭成 > <，原地甩两下头 */
  function runDizzyOut() {
    if (!el) return;
    if (dizzySettle) { clearTimeout(dizzySettle); dizzySettle = null; }
    if (dizzyFallback) { clearTimeout(dizzyFallback); dizzyFallback = null; }
    delete el.dataset.spin;
    setMood('daze', DAZE_MS);
    say('……', DAZE_MS, false);
  }

  function feedDrag(e) {
    const now = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    dragSamples.push({ x: e.clientX, y: e.clientY, t: now });
    while (dragSamples.length && now - dragSamples[0].t > DIZZY_WINDOW) dragSamples.shift();
    if (dragSamples.length < 2) return;

    const a = dragSamples[dragSamples.length - 2];
    const b = dragSamples[dragSamples.length - 1];
    const dt = b.t - a.t;
    let fast = false;
    if (dt > 0 && ((Math.hypot(b.x - a.x, b.y - a.y) / dt) * 1000) > DIZZY_SPEED) fast = true;

    let path = 0;
    for (let i = 1; i < dragSamples.length; i++) {
      path += Math.hypot(dragSamples[i].x - dragSamples[i - 1].x, dragSamples[i].y - dragSamples[i - 1].y);
    }
    const first = dragSamples[0];
    const last = dragSamples[dragSamples.length - 1];
    const disp = Math.hypot(last.x - first.x, last.y - first.y);
    const circle = path > 600 && path / Math.max(disp, 20) > 3.2;

    if (fast || circle) makeDizzy();
  }

  /* ---------- 蹦跶 ---------- */
  function hop() {
    if (!el || prefersReduced()) return;
    el.dataset.hop = '1';
    if (hopTimer) clearTimeout(hopTimer);
    hopTimer = setTimeout(() => {
      if (el) delete el.dataset.hop;
      hopTimer = null;
    }, 540);
  }

  /* 连点三下及以上：不高兴，不解题 */
  function tripleTap() {
    if (!el) return;
    setMood('angry', 1000);
    say('戳我干嘛…', 1300, false);
  }

  /* 双击：蹦一下 + 开心，不当成一键解题 */
  function doubleTap() {
    if (!el) return;
    hop();
    if (el.dataset.state === 'idle') setMood('happy', 800);
    say('嘿嘿', 900, false);
  }

  function scheduleWander(delay) {
    if (wanderTimer) clearTimeout(wanderTimer);
    wanderTimer = null;
    if (prefersReduced()) return;
    wanderTimer = setTimeout(wander, delay != null ? delay : 12000 + Math.random() * 14000);
  }

  /* 条件不满足就很快再试一次，别一等又是二十秒 */
  function wanderLater() {
    scheduleWander(2200 + Math.random() * 2800);
  }

  function wander() {
    wanderTimer = null;
    if (!el || el.dataset.state !== 'idle' || drag || tracking) return wanderLater();
    if (el.dataset.mood === 'sleepy') return;   // 睡着了就老实待着
    if (el.dataset.mood) return wanderLater();  // 正在做表情，等它做完
    try {
      if (document.hidden) return wanderLater();
    } catch (e) {}

    const r = el.getBoundingClientRect();
    const p = clampPos(r.left + (Math.random() * 2 - 1) * 120, r.top + (Math.random() * 2 - 1) * 80);
    if (Math.abs(p.left - r.left) < 6 && Math.abs(p.top - r.top) < 6) return wanderLater();

    hop();
    el.style.transition = 'left .62s cubic-bezier(.34,1.2,.64,1), top .62s cubic-bezier(.34,1.2,.64,1)';
    moveTo(p.left, p.top);
    setTimeout(() => {
      if (el) el.style.transition = '';
    }, 650);
    setTimeout(savePos, 630);
    scheduleWander();
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
    feedDrag(e);
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
    snapToEdge();
    savePos();
    if (el) {
      // 刚被甩晕的话，走惯性 → 闭眼甩头，别立刻换笑脸
      if (el.dataset.mood === 'dizzy') {
        settleDizzy();
      } else {
        setMood('happy', 900);
        say('放这儿啦', 1400, false);
      }
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
      if (!el || el.dataset.state !== 'idle' || el.dataset.mood || drag || tracking) return;
      const m = pickMood();
      if (m) setMood(m.k, m.ms);
    }, 5200);
    sleepTimer = setTimeout(() => {
      if (el && el.dataset.state === 'idle' && !el.dataset.mood) {
        setMood('sleepy', 0);
        // 睡了就别再惦记着到处蹦
        if (wanderTimer) { clearTimeout(wanderTimer); wanderTimer = null; }
      }
    }, 50000);
    // 醒着的时候：隔一会儿挪一小段，别等太久
    scheduleWander(7000 + Math.random() * 6000);
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

  /* ---------- 被戳烦了 ---------- */
  function poke() {
    const now = Date.now();
    pokeTimes = pokeTimes.filter((t) => now - t < 2600);
    pokeTimes.push(now);
    if (pokeTimes.length < 3) return;
    pokeTimes = [];
    setMood('angry', 1000);
    say('别戳啦，在算了', 1400, false);
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
      '<span class="qc-bot-spiral"><svg viewBox="0 0 10 10" aria-hidden="true"><path d="' + SPIRAL + '"/></svg><svg viewBox="0 0 10 10" aria-hidden="true"><path d="' + SPIRAL + '"/></svg></span>' +
      '<span class="qc-bot-zzz"><i>z</i><i>z</i><i>z</i></span>' +
      '<svg class="qc-bot-tick" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 12.5 L10 17 L18.5 7.5"/></svg>' +
      '</span></span>' +
      '<span class="qc-bot-bubble"></span>';

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (suppressClick) return;

      // 它正在算的时候戳它，戳三次会烦
      if (Q.isBusy && Q.isBusy()) {
        poke();
        return;
      }

      // 连击串：520ms 内接着点算同一串，第二下蹦、第三下起一律不解题
      const now = Date.now();
      if (now - lastTapAt > TAP_CHAIN_MS) {
        tapCount = 0;
        doublePlayed = false;
      }
      tapCount++;
      lastTapAt = now;

      if (tapCount === 1) {
        // 第一下：先不执行，留出错开双击的时间
        if (clickTimer) clearTimeout(clickTimer);
        clickTimer = setTimeout(() => {
          clickTimer = null;
          tapCount = 0;
          doublePlayed = false;
          if (Q.oneKeyFlow) Q.oneKeyFlow({ from: 'mascot' });
        }, DOUBLE_MS);
        return;
      }

      // 第二下起就不再解题了，把待执行的那一次按下取消
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
      }

      if (tapCount === 2) {
        // 先别急着蹦：万一还有第三下，就只算「戳」，不先蹦一次
        if (doubleTimer) clearTimeout(doubleTimer);
        doubleTimer = setTimeout(() => {
          doubleTimer = null;
          doublePlayed = true;
          doubleTap();
        }, TAP_GAP_MS);
        return;
      }

      // 第三下及以后
      if (doubleTimer) { clearTimeout(doubleTimer); doubleTimer = null; }
      // 已经蹦过了（这三下点得比较散）就别再凶一次，安静收场
      if (doublePlayed) return;
      tripleTap();
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
      window.addEventListener('pointermove', onWindowMove, { passive: true });
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
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      if (el && (el.dataset.state === 'done' || el.dataset.state === 'warn' || el.dataset.state === 'error')) {
        el.dataset.state = 'idle';
        clearMood();
        const b = el.querySelector('.qc-bot-bubble');
        if (b && b.dataset.act !== '1') say('', 0, false);
        startIdle();
      }
      settleTimer = null;
    }, ms || 2600);
  }

  function show(visible) {
    if (!el) return;
    el.style.display = visible ? 'flex' : 'none';
  }

  function destroy() {
    stopIdle();
    clearMood();
    stopFollow();
    if (hopTimer) { clearTimeout(hopTimer); hopTimer = null; }
    if (wanderTimer) { clearTimeout(wanderTimer); wanderTimer = null; }
    if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
    if (doubleTimer) { clearTimeout(doubleTimer); doubleTimer = null; }
    if (dizzySettle) { clearTimeout(dizzySettle); dizzySettle = null; }
    if (dizzyFallback) { clearTimeout(dizzyFallback); dizzyFallback = null; }
    if (settleTimer) { clearTimeout(settleTimer); settleTimer = null; }
    tapCount = 0;
    doublePlayed = false;
    lastTapAt = 0;
    if (rafId && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafId);
    rafId = 0;
    dragSamples = [];
    try {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onWindowMove);
    } catch (e) {}
    drag = null;
    if (el && el.isConnected) el.remove();
    el = null;
  }

  Q.mascot = { mount, getState, setState, setMood, say, settleAfter, show, destroy, moveTo, hop, wanderOnce: wander, CSS };
})();
