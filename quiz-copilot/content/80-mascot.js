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
    --qc-a: #4b86ff; --qc-b: #6b5cf0; --qc-glow: rgba(59,123,255,.4);
  }
  /* 它本质是个 <button>：按住拖动会拿到焦点，浏览器于是在外面画一圈黑框，
     点别处才消失，再拖又出来。桌宠不需要这个焦点框，直接去掉。 */
  .qc-bot:focus,
  .qc-bot:focus-visible { outline: none; }

  /* 皮肤只换机身的两个渐变色，状态色（绿/黄/红）优先级更高 */
  .qc-bot[data-skin="mint"] { --qc-a: #2fd6a4; --qc-b: #0f9d78; --qc-glow: rgba(47,214,164,.38); }
  .qc-bot[data-skin="peach"] { --qc-a: #ff9d78; --qc-b: #ef5f5f; --qc-glow: rgba(255,140,110,.38); }
  .qc-bot[data-skin="ink"] { --qc-a: #5b6472; --qc-b: #2b3240; --qc-glow: rgba(91,100,114,.34); }
  .qc-bot[data-dragging="1"] { cursor: grabbing; }
  .qc-bot[data-dragging="1"] .qc-bot-body { transform: scale(1.06) rotate(-3deg); }
  .qc-bot:active .qc-bot-body { transform: scale(.93); }

  .qc-bot-body {
    width: 38px; height: 40px;
    display: flex; flex-direction: column; align-items: center;
    transform-origin: 50% 100%;
    animation: qc-bot-tilt 13s ease-in-out infinite;
    transition: transform .16s ease, opacity .16s ease, width .2s ease, height .2s ease,
                border-radius .2s ease, background .2s ease, box-shadow .2s ease;
  }
  .qc-bot-antenna {
    position: relative; width: 2px; height: 7px; border-radius: 1px;
    background: rgba(255,255,255,.5); margin-bottom: -1px;
    transform-origin: 50% 100%;
    transition: transform .18s ease, opacity .2s ease;
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
    background: linear-gradient(150deg, var(--qc-a), var(--qc-b));
    border: 1px solid rgba(255,255,255,.22);
    box-shadow: 0 6px 18px var(--qc-glow), inset 0 1px 0 rgba(255,255,255,.26);
    display: flex; align-items: center; justify-content: center;
    animation: qc-bot-breathe 3.6s ease-in-out infinite;
    transition: filter .15s, background .38s ease, box-shadow .38s ease,
                transform .38s cubic-bezier(.34,1.3,.64,1);
  }
  .qc-bot:hover .qc-bot-head { filter: brightness(1.08); }
  .qc-bot-eyes {
    display: flex; gap: 8px;
    animation: qc-bot-look 9s ease-in-out infinite;
  }
  .qc-bot-eye {
    width: 6px; height: 9px; border-radius: 3px; background: #fff;
    border: 0 solid #fff;
    animation: qc-bot-blink 5.4s ease-in-out infinite;
    /* 留一点回弹：换表情时眼睛是有惯性的，不是瞬间跳过去 */
    transition:
      width .26s cubic-bezier(.34,1.2,.64,1),
      height .26s cubic-bezier(.34,1.2,.64,1),
      border-width .24s ease,
      border-radius .24s ease,
      background .24s ease,
      transform .24s ease;
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

  /* 被摸头：眼睛弯成月牙 + 脸颊泛红 + 冒爱心 */
  .qc-bot[data-mood="pet"] .qc-bot-eye {
    width: 8px; height: 5px; background: transparent;
    border-top: 2.5px solid #fff; border-radius: 5px 5px 0 0;
    transform: translateY(1px);
  }
  .qc-bot[data-mood="pet"] .qc-bot-blush { opacity: 1; }
  .qc-bot[data-mood="pet"] .qc-bot-hearts { opacity: 1; }
  .qc-bot[data-mood="pet"] .qc-bot-body { animation: qc-bot-petrock .95s ease-in-out infinite; }

  /* 打哈欠：眼睛拉成两条缝，脑袋微微后仰 */
  .qc-bot[data-mood="yawn"] .qc-bot-eye {
    width: 7px; height: 2.5px; border-radius: 2px; transform: translateY(1px);
  }
  .qc-bot[data-mood="yawn"] .qc-bot-head {
    animation: none; transform: rotate(-5deg) translateY(-1px) scale(1.04);
  }

  /* ---------- 收尾惯性：表情不是硬切，而是慢慢散掉 ---------- */
  /* 摸头松手：摇摆幅度一次比一次小，爱心边飘边淡，腮红先褪 */
  .qc-bot[data-mood="pet"][data-mood-out] .qc-bot-body {
    animation: qc-bot-petrock-out .92s cubic-bezier(.3,.05,.2,1) 1 both;
  }
  .qc-bot[data-mood="pet"][data-mood-out] .qc-bot-blush {
    opacity: 0; transition: opacity .6s ease .08s;
  }
  .qc-bot[data-mood="pet"][data-mood-out] .qc-bot-hearts {
    opacity: 0; transition: opacity .55s ease .32s;
  }
  /* 哈欠收尾：脑袋自己慢慢回正 */
  .qc-bot[data-mood="yawn"][data-mood-out] .qc-bot-head {
    animation: none; transform: rotate(0) translateY(0) scale(1);
    transition: transform .62s cubic-bezier(.34,1.32,.64,1);
  }
  .qc-bot[data-mood="yawn"][data-mood-out] .qc-bot-eye { transition-duration: .46s; }
  /* 晕完收尾：>< 慢慢展开回圆眼 */
  .qc-bot[data-mood="daze"][data-mood-out] .qc-bot-eye { transition-duration: .42s; }

  /* 好奇：脑袋歪过去盯着你（天线跟着歪，不然看起来还是正的） */
  .qc-bot[data-tilt="1"] .qc-bot-head {
    animation: none; transform: rotate(-12deg) translate(-1px, 1px);
  }
  .qc-bot[data-tilt="1"] .qc-bot-antenna { transform: translateX(-3px); }
  .qc-bot[data-tilt="1"] .qc-bot-eyes { animation: none; transform: translate(1px, -2px); }

  /* 回正也带过冲：转过头一点点再摆回来 */
  .qc-bot[data-tilt="out"] .qc-bot-head {
    animation: none; transform: rotate(0) translate(0, 0);
    transition: transform .5s cubic-bezier(.34,1.46,.5,1);
  }
  .qc-bot[data-tilt="out"] .qc-bot-antenna {
    transform: translateX(0);
    transition: transform .5s cubic-bezier(.34,1.46,.5,1);
  }
  .qc-bot[data-tilt="out"] .qc-bot-eyes {
    animation: none; transform: translate(0, -1px);
    transition: transform .5s cubic-bezier(.34,1.46,.5,1);
  }

  /* 脸颊 */
  .qc-bot-blush {
    position: absolute; inset: 0; opacity: 0;
    transition: opacity .2s; pointer-events: none;
  }
  .qc-bot-blush i {
    position: absolute; top: 20px;
    width: 7px; height: 3.5px; border-radius: 50%;
    background: rgba(255,122,150,.6);
  }
  .qc-bot-blush i:first-child { left: 4px; }
  .qc-bot-blush i:last-child { right: 4px; }

  /* 头顶冒出来的爱心 */
  .qc-bot-hearts {
    position: absolute; left: 50%; top: -13px;
    width: 0; height: 0; opacity: 0;
    transition: opacity .2s; pointer-events: none;
  }
  .qc-bot-heart {
    position: absolute; width: 5px; height: 5px;
    background: #ff90a8; border-radius: 1px;
    transform: rotate(45deg);
  }
  .qc-bot-heart::before, .qc-bot-heart::after {
    content: ''; position: absolute; width: 5px; height: 5px;
    border-radius: 50%; background: inherit;
  }
  .qc-bot-heart::before { left: -2.5px; top: 0; }
  .qc-bot-heart::after { top: -2.5px; left: 0; }
  .qc-bot[data-mood="pet"] .qc-bot-heart { animation: qc-bot-heart 1.5s ease-out infinite; }
  .qc-bot[data-mood="pet"] .qc-bot-heart:nth-child(1) { animation-delay: 0s; }
  .qc-bot[data-mood="pet"] .qc-bot-heart:nth-child(2) { animation-delay: .5s; margin-left: 9px; }
  .qc-bot[data-mood="pet"] .qc-bot-heart:nth-child(3) { animation-delay: 1s; margin-left: -8px; }

  /* 结网：很久没人理，右上角结一张蜘蛛网，网上挂只小蜘蛛 */
  .qc-bot-web {
    position: absolute; right: -5px; top: -7px;
    width: 30px; height: 30px;
    opacity: 0; pointer-events: none;
    transform-origin: 100% 0;
    transform: rotate(-14deg) scale(.45);
    transition: opacity .45s ease, transform .55s cubic-bezier(.34,1.25,.64,1);
  }
  .qc-bot[data-web="1"] .qc-bot-web { opacity: .85; transform: rotate(0) scale(1); }
  .qc-bot[data-web="1"] .qc-bot-web svg { animation: qc-bot-websway 6.5s ease-in-out infinite; }
  /* 一碰就散：网甩开淡掉，蜘蛛掉下去 */
  .qc-bot[data-web="clear"] .qc-bot-web { opacity: 0; transform: rotate(8deg) scale(1.3); }
  .qc-bot[data-web="clear"] .qc-web-spider {
    transform: translateY(16px) rotate(26deg); opacity: 0;
  }
  .qc-bot[data-web="clear"] .qc-bot-body { animation: qc-bot-webshake .42s ease-out 1; }
  .qc-bot-web svg { display: block; width: 100%; height: 100%; overflow: visible; }
  .qc-bot-web path {
    fill: none; stroke: rgba(236,242,252,.58);
    stroke-width: .7; stroke-linecap: round;
  }
  .qc-web-spider {
    transform-origin: 0 0;
    transition: transform .46s cubic-bezier(.5,0,.9,.4), opacity .36s ease .05s;
  }

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
  /* 甩头不转脑袋，靠两只眼睛整体左右荡来表现；幅度一下比一下小，最后停住 */
  .qc-bot[data-mood="daze"] .qc-bot-eyes {
    /* 两只眼睛各自转了 45°，内侧的空隙会被吃掉，所以这里单独拉开一点 */
    gap: 12px;
    animation: qc-bot-eyeshake 1.15s cubic-bezier(.33,.02,.25,1) 1 both;
  }

  /* 双击 / 无聊时蹦一下 */
  .qc-bot[data-hop="1"] .qc-bot-body { animation: qc-bot-hop .52s cubic-bezier(.3,.8,.4,1); }

  /* 打瞌睡时头上飘 z z z */
  .qc-bot-zzz {
    position: absolute; right: -14px; top: -16px;
    width: 26px; height: 28px;
    opacity: 0; pointer-events: none;
    transition: opacity .25s, transform .38s cubic-bezier(.34,1.15,.64,1);
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
  /* 睡到结网时：网占了右上角，zzz 滑到左上，不然两撮线条糊成一团 */
  .qc-bot[data-web="1"][data-mood="sleepy"] .qc-bot-zzz { transform: translate(-34px, -11px); }

  .qc-bot-tick {
    position: absolute; inset: 0; margin: auto;
    width: 22px; height: 22px; opacity: 0;
    transition: opacity .28s ease;
  }
  .qc-bot-tick path {
    fill: none; stroke: #fff; stroke-width: 2.8;
    stroke-linecap: round; stroke-linejoin: round;
    stroke-dasharray: 26; stroke-dashoffset: 26;
  }

  /* ---------- 番茄钟计时牌：一直挂在头顶，不用悬停 ---------- */
  .qc-pomo {
    position: absolute; left: 50%; bottom: calc(100% + 7px);
    transform: translate(-50%, 4px) scale(.9);
    display: flex; align-items: center; justify-content: center;
    min-width: 46px; padding: 3px 7px 6px;
    border-radius: 8px;
    background: rgba(18,22,30,.95);
    border: 1px solid rgba(127,163,255,.32);
    box-shadow: 0 4px 14px rgba(0,0,0,.5);
    font-family: ui-monospace, Consolas, "Cascadia Code", monospace;
    font-size: 10.5px; font-weight: 700; letter-spacing: .4px;
    color: #dbe6ff; line-height: 1.15;
    opacity: 0; pointer-events: none; white-space: nowrap;
    transition: opacity .24s ease, transform .34s cubic-bezier(.34,1.3,.64,1);
  }
  .qc-pomo[data-on="1"] { opacity: 1; transform: translate(-50%, 0) scale(1); }
  .qc-pomo[data-mode="break"] { border-color: rgba(110,231,168,.42); color: #b6f3d5; }
  .qc-pomo[data-mode="done"] {
    border-color: rgba(251,191,36,.55); color: #ffe2a8;
    animation: qc-pomo-blink .82s ease-in-out 5;
  }
  .qc-pomo-t { position: relative; z-index: 1; }
  .qc-pomo-bar {
    position: absolute; left: 4px; right: 4px; bottom: 2px; height: 2px;
    border-radius: 2px; background: rgba(255,255,255,.13); overflow: hidden;
  }
  .qc-pomo-bar i {
    display: block; height: 100%; width: 100%; border-radius: 2px;
    background: linear-gradient(90deg, #4f8cff, #7c5cff);
    transition: width 1s linear;
  }
  .qc-pomo[data-mode="break"] .qc-pomo-bar i { background: linear-gradient(90deg, #34d399, #0f9d63); }
  .qc-pomo[data-mode="done"] .qc-pomo-bar i { background: #fbbf24; width: 0 !important; }
  /* 机器人贴近屏幕顶部时，气泡会挂到下方，计时牌就挪到左边，避免撞在一起 */
  .qc-bot[data-v="down"] .qc-pomo {
    bottom: auto; top: 50%; left: auto; right: calc(100% + 6px);
    transform: translate(4px, -50%) scale(.9);
    transform-origin: 100% 50%;
  }
  .qc-bot[data-v="down"] .qc-pomo[data-on="1"] { transform: translate(0, -50%) scale(1); }
  @keyframes qc-pomo-blink { 0%, 100% { opacity: 1 } 50% { opacity: .32 } }

  .qc-bot-bubble {
    position: absolute; right: 54px; bottom: 10px;
    /* max-content + max-width：短句贴着字走，长句最多 240px 再换行 */
    width: max-content; max-width: 240px;
    padding: 6px 10px;
    border-radius: 10px;
    background: #1b1f28; color: #d7dbe2;
    border: 1px solid rgba(255,255,255,.13);
    font-size: 12px; line-height: 1.45;
    text-align: left; white-space: normal;
    box-shadow: 0 6px 20px rgba(0,0,0,.5);
    opacity: 0; transform: translateY(4px) scale(.94);
    transform-origin: 100% 100%;
    transition: opacity .16s ease, transform .16s ease;
    pointer-events: none;
  }
  /* 文字在外面这层才做行数截断：气泡本身不裁，箭头才不会被切掉 */
  .qc-bot-bubble-txt {
    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3;
    overflow: hidden; overflow-wrap: anywhere; word-break: break-word;
  }
  .qc-bot-bubble[data-show="1"] { opacity: 1; transform: translateY(0) scale(1); }
  .qc-bot-bubble[data-act="1"] {
    pointer-events: auto; cursor: pointer;
    border-color: rgba(127,163,255,.5);
    color: #eaf0ff;
  }
  .qc-bot-bubble[data-act="1"]:hover { background: #232838; }
  .qc-bot-bubble[data-act="1"] .qc-bot-bubble-txt::before {
    content: '详情 ';
    color: #8fb2ff; font-size: 11px; letter-spacing: .5px;
  }

  /* 气泡默认挂在机器人左边；贴到屏幕左缘时翻到右边 */
  .qc-bot-bubble::after {
    content: ''; position: absolute; right: -5px; bottom: 10px;
    width: 8px; height: 8px; background: inherit;
    border-right: 1px solid rgba(255,255,255,.13);
    border-top: 1px solid rgba(255,255,255,.13);
    transform: rotate(45deg);
  }
  .qc-bot-bubble[data-act="1"]::after { border-color: rgba(127,163,255,.5); }

  .qc-bot[data-bubble="right"] .qc-bot-bubble {
    right: auto; left: 54px; transform-origin: 0 100%;
  }
  .qc-bot[data-bubble="right"] .qc-bot-bubble::after {
    right: auto; left: -5px; transform: rotate(225deg);
  }

  /* 机器人贴近屏幕顶部时，气泡挂到下面 */
  .qc-bot[data-v="down"] .qc-bot-bubble { bottom: auto; top: 54px; }
  .qc-bot[data-v="down"] .qc-bot-bubble::after {
    bottom: auto; top: -5px; right: 14px; transform: rotate(-45deg);
  }
  .qc-bot[data-v="down"][data-bubble="right"] .qc-bot-bubble::after {
    right: auto; left: 14px;
  }


  /* ---------- 化成球滚过去 ---------- */
  .qc-bot[data-form="ball"] { cursor: default; }

  /* 机器人整体缩小淡出——不做宽高变形，否则中途会露出方角 */
  .qc-bot[data-form="ball"] .qc-bot-body {
    opacity: 0;
    transform: scale(.35);
    animation: none;
    transition: opacity .16s ease, transform .2s cubic-bezier(.3,1.2,.5,1);
  }
  .qc-bot[data-form="ball"] .qc-bot-tick,
  .qc-bot[data-form="ball"] .qc-bot-bubble,
  .qc-bot[data-form="ball"] .qc-pomo { opacity: 0 !important; }

  /* 球是单独一层，本来就是圆的，只做缩放，形状不会变 */
  .qc-ball {
    position: absolute; left: 50%; top: 50%;
    width: 34px; height: 34px; margin: -17px 0 0 -17px;
    opacity: 0; transform: scale(.3);
    transition: opacity .16s ease, transform .2s cubic-bezier(.3,1.35,.5,1);
    pointer-events: none; z-index: 1;
  }
  .qc-bot[data-form="ball"] .qc-ball { opacity: 1; transform: scale(1); }
  .qc-ball i {
    display: block; width: 100%; height: 100%; border-radius: 50%;
    background: radial-gradient(circle at 34% 28%, #b3cdff 0%, #4f8cff 48%, #2749c4 100%);
    box-shadow: 0 5px 14px rgba(40,80,200,.55), inset 0 -3px 6px rgba(0,0,0,.3);
    position: relative;
    transform: rotate(var(--qc-roll, 0rad));
  }
  /* 球上的一点高光，转起来才看得出在滚 */
  .qc-ball i::after {
    content: ''; position: absolute; left: 50%; top: 5px;
    width: 5px; height: 5px; margin-left: -2.5px; border-radius: 50%;
    background: rgba(255,255,255,.85);
    box-shadow: 0 0 6px rgba(255,255,255,.6);
  }

  /* ============================================================
   * 赶路方式：滚 / 开车 / 纸飞机 / 任意门 / 魔法 / 瞬移
   * 道具都是 .qc-bot 的直接子元素（和 .qc-ball 同级），
   * 这样才能脱离 body 的呼吸/歪头变换，独立摆位
   * ============================================================ */
  .qc-car, .qc-plane, .qc-door, .qc-spark, .qc-ring {
    position: absolute; left: 50%; top: 50%;
    opacity: 0; pointer-events: none; z-index: 2;
  }
  /* 变形/传送途中不显示头顶计时牌，免得挂在车顶上 */
  .qc-bot[data-travel] .qc-pomo { opacity: 0 !important; }

  /* ---- 小汽车 ---- */
  .qc-car {
    width: 40px; height: 24px; margin: -16px 0 0 -20px;
    transform: translateY(var(--qc-bump, 0px));
  }
  .qc-car-body {
    position: absolute; left: 0; bottom: 4px; width: 40px; height: 12px;
    border-radius: 5px 10px 4px 4px;
    background: linear-gradient(160deg, #ff9a66, #e0512c);
    box-shadow: 0 3px 8px rgba(180,60,20,.38), inset 0 1px 0 rgba(255,255,255,.45);
  }
  .qc-car-cab {
    position: absolute; left: 9px; bottom: 14px; width: 21px; height: 8px;
    border-radius: 7px 7px 2px 2px;
    background: linear-gradient(160deg, #ffe0cc, #ffab84);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.7);
  }
  .qc-car-w1, .qc-car-w2 {
    position: absolute; bottom: 0; width: 9px; height: 9px; border-radius: 50%;
    background: radial-gradient(circle at 38% 34%, #6b7280, #262c39 72%);
    box-shadow: 0 1px 3px rgba(0,0,0,.35);
  }
  .qc-car-w1 { left: 5px; }
  .qc-car-w2 { right: 6px; }
  .qc-car-w1::after, .qc-car-w2::after {
    content: ''; position: absolute; left: 50%; top: 1.6px;
    width: 1.6px; height: 5.8px; margin-left: -.8px; border-radius: 1px;
    background: rgba(255,255,255,.6);
  }
  .qc-bot[data-travel="car"] .qc-car { opacity: 1; }
  .qc-bot[data-travel="car"] .qc-car-w1,
  .qc-bot[data-travel="car"] .qc-car-w2 { animation: qc-wheel .42s linear infinite; }
  @keyframes qc-wheel { 0% { transform: rotate(0) } 100% { transform: rotate(360deg) } }

  /* ---- 纸飞机 ---- */
  .qc-plane {
    width: 34px; height: 24px; margin: -13px 0 0 -17px;
    transform: rotate(var(--qc-fly, 0deg));
    filter: drop-shadow(0 3px 6px rgba(40,70,120,.35));
  }
  .qc-plane svg { display: block; width: 100%; height: 100%; overflow: visible; }
  .qc-bot[data-travel="plane"] .qc-plane { opacity: 1; }

  /* ---- 任意门 ---- */
  .qc-door {
    width: 34px; height: 46px; margin: -26px 0 0 -17px;
    border: 3px solid #6d5138; border-radius: 7px 7px 2px 2px;
    background: #1b2233;
    box-shadow: 0 4px 12px rgba(20,30,60,.45);
    perspective: 90px;
  }
  .qc-door-panel {
    position: absolute; inset: 0;
    background: linear-gradient(150deg, #9a7550, #6f5336);
    border-radius: 3px 3px 0 0;
    transform-origin: 0 50%;
    backface-visibility: hidden;
  }
  .qc-door-knob {
    position: absolute; right: 4px; top: 50%; width: 3.4px; height: 3.4px;
    margin-top: -1.7px; border-radius: 50%; background: #f6d365;
    box-shadow: 0 0 4px rgba(246,211,101,.8);
  }
  .qc-bot[data-travel="portal"] .qc-door { opacity: 1; }
  .qc-bot[data-travel="portal"][data-tph="1"] .qc-door { animation: qc-door-pop .42s ease-out; }
  .qc-bot[data-travel="portal"][data-tph="1"] .qc-door-panel { animation: qc-door-swing .42s ease-in both; }
  .qc-bot[data-travel="portal"][data-tph="2"] .qc-door { animation: qc-door-leave .66s ease-out both; }
  .qc-bot[data-travel="portal"][data-tph="2"] .qc-door-panel { transform: rotateY(-72deg); }

  @keyframes qc-door-pop {
    0% { opacity: 0; transform: scale(.4); }
    70% { opacity: 1; transform: scale(1.06); }
    100% { opacity: 1; transform: scale(1); }
  }
  @keyframes qc-door-swing {
    0% { transform: rotateY(0deg); }
    100% { transform: rotateY(-72deg); }
  }
  @keyframes qc-door-leave {
    0% { opacity: 1; transform: scale(1); }
    70% { opacity: 1; }
    100% { opacity: 0; transform: scale(.9); }
  }

  /* ---- 魔法星火 ---- */
  .qc-spark { width: 0; height: 0; }
  .qc-spark i {
    position: absolute; width: 5px; height: 5px; margin: -2.5px 0 0 -2.5px;
    border-radius: 1px; background: #ffe9a3;
    box-shadow: 0 0 7px rgba(255,214,110,.95);
    transform: rotate(calc(45deg + var(--a))) translateX(0) scale(.4);
  }
  .qc-spark i:nth-child(1) { --a: 0deg; }
  .qc-spark i:nth-child(2) { --a: 60deg; }
  .qc-spark i:nth-child(3) { --a: 120deg; }
  .qc-spark i:nth-child(4) { --a: 180deg; }
  .qc-spark i:nth-child(5) { --a: 240deg; }
  .qc-spark i:nth-child(6) { --a: 300deg; }
  .qc-bot[data-travel="magic"][data-tph="1"] .qc-spark i { animation: qc-spark-out .55s ease-out both; }
  .qc-bot[data-travel="magic"][data-tph="2"] .qc-spark i { animation: qc-spark-in .62s ease-out both; }

  @keyframes qc-spark-out {
    0% { opacity: 0; transform: rotate(calc(45deg + var(--a))) translateX(2px) scale(.3); }
    30% { opacity: 1; }
    100% { opacity: 0; transform: rotate(calc(45deg + var(--a))) translateX(23px) scale(1); }
  }
  @keyframes qc-spark-in {
    0% { opacity: 0; transform: rotate(calc(45deg + var(--a))) translateX(23px) scale(.9); }
    35% { opacity: 1; }
    100% { opacity: 0; transform: rotate(calc(45deg + var(--a))) translateX(3px) scale(.3); }
  }

  /* ---- 瞬移光环 ---- */
  .qc-ring {
    width: 46px; height: 46px; margin: -23px 0 0 -23px; border-radius: 50%;
    border: 2px solid rgba(160,205,255,.95);
    box-shadow: 0 0 12px rgba(120,180,255,.6), inset 0 0 8px rgba(120,180,255,.4);
  }
  .qc-bot[data-travel="blink"][data-tph="2"] .qc-ring { animation: qc-ring .62s ease-out both; }

  @keyframes qc-ring {
    0% { opacity: 0; transform: scale(.25); }
    22% { opacity: 1; }
    100% { opacity: 0; transform: scale(1.6); }
  }

  /* 车和飞机出场时把本体藏起来 */
  .qc-bot[data-travel="car"] .qc-bot-body,
  .qc-bot[data-travel="plane"] .qc-bot-body { opacity: 0; transform: scale(.55); }
  .qc-bot[data-travel="portal"] .qc-bot-body { animation: qc-body-in-door .55s ease-in both; }
  .qc-bot[data-travel="portal"][data-tph="2"] .qc-bot-body { animation: qc-body-out-door .68s cubic-bezier(.34,1.4,.64,1) both; }
  .qc-bot[data-travel="magic"] .qc-bot-body { animation: qc-body-poof .55s ease-in both; }
  .qc-bot[data-travel="magic"][data-tph="2"] .qc-bot-body { animation: qc-body-appear .62s cubic-bezier(.34,1.5,.64,1) both; }
  .qc-bot[data-travel="blink"] .qc-bot-body { animation: qc-body-blink-out .28s ease-in both; }
  .qc-bot[data-travel="blink"][data-tph="2"] .qc-bot-body { animation: qc-body-blink-in .4s ease-out both; }

  @keyframes qc-body-in-door {
    0% { opacity: 1; transform: scale(1) translateY(0); }
    38% { opacity: 1; transform: scale(.72) translateY(7px); }
    100% { opacity: 0; transform: scale(.12) translateY(14px); }
  }
  @keyframes qc-body-out-door {
    0% { opacity: 0; transform: scale(.12) translateY(14px); }
    58% { opacity: 1; transform: scale(1.08) translateY(0); }
    100% { opacity: 1; transform: scale(1) translateY(0); }
  }
  @keyframes qc-body-poof {
    0% { opacity: 1; transform: scale(1) rotate(0); }
    55% { opacity: .95; transform: scale(.88) rotate(-7deg); }
    100% { opacity: 0; transform: scale(.18) rotate(-26deg); }
  }
  @keyframes qc-body-appear {
    0% { opacity: 0; transform: scale(.18) rotate(22deg); }
    58% { opacity: 1; transform: scale(1.12) rotate(-3deg); }
    100% { opacity: 1; transform: scale(1) rotate(0); }
  }
  @keyframes qc-body-blink-out {
    0% { opacity: 1; transform: scale(1); filter: brightness(1); }
    68% { opacity: .85; transform: scale(.85); filter: brightness(2.6); }
    100% { opacity: 0; transform: scale(.7); filter: brightness(3); }
  }
  @keyframes qc-body-blink-in {
    0% { opacity: 0; transform: scale(.7); filter: brightness(3); }
    55% { opacity: 1; transform: scale(1.1); filter: brightness(1.4); }
    100% { opacity: 1; transform: scale(1); filter: brightness(1); }
  }

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
  @keyframes qc-bot-work {
    0%, 11% { transform: translate(-1.6px, .6px); opacity: .72 }
    22%, 34% { transform: translate(1.6px, -.4px); opacity: 1 }
    46%, 58% { transform: translate(-1.2px, .7px); opacity: .78 }
    70%, 100% { transform: translate(.8px, 0); opacity: 1 }
  }
  @keyframes qc-bot-zzz {
    0% { opacity: 0; transform: translate(0, 2px) scale(.7) }
    16% { opacity: 1 }
    68% { opacity: .95 }
    100% { opacity: 0; transform: translate(10px, -16px) scale(1.05) }
  }
  @keyframes qc-bot-dizzy { to { transform: rotate(360deg) } }
  @keyframes qc-bot-eyeshake {
    0%   { transform: translateX(0) }
    6%   { transform: translateX(-3.2px) }
    16%  { transform: translateX(3px) }
    27%  { transform: translateX(-2.4px) }
    38%  { transform: translateX(2.1px) }
    49%  { transform: translateX(-1.5px) }
    60%  { transform: translateX(1.2px) }
    70%  { transform: translateX(-.8px) }
    80%  { transform: translateX(.5px) }
    89%  { transform: translateX(-.25px) }
    100% { transform: translateX(0) }
  }
  @keyframes qc-bot-petrock {
    0%, 100% { transform: rotate(0) }
    25% { transform: rotate(-3.5deg) }
    75% { transform: rotate(3.5deg) }
  }
  @keyframes qc-bot-petrock-out {
    0%   { transform: rotate(3.2deg) }
    18%  { transform: rotate(-2.6deg) }
    36%  { transform: rotate(2deg) }
    54%  { transform: rotate(-1.5deg) }
    72%  { transform: rotate(1deg) }
    87%  { transform: rotate(-.5deg) }
    100% { transform: rotate(0) }
  }
  @keyframes qc-bot-webshake {
    0% { transform: rotate(0) }
    22% { transform: rotate(-2.6deg) }
    55% { transform: rotate(2.2deg) }
    78% { transform: rotate(-.9deg) }
    100% { transform: rotate(0) }
  }
  @keyframes qc-bot-websway {
    0%, 100% { transform: rotate(0) }
    50% { transform: rotate(-2.4deg) }
  }
  @keyframes qc-bot-heart {
    0% { opacity: 0; transform: translate(0, 0) rotate(45deg) scale(.55) }
    18% { opacity: 1 }
    100% { opacity: 0; transform: translate(7px, -21px) rotate(45deg) scale(1) }
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
  .qc-bot[data-state="thinking"] .qc-bot-eyes { animation: qc-bot-work .92s ease-in-out infinite; }
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

  /* ---------- 换装配件 ---------- */
  .qc-bot-hat, .qc-bot-ears, .qc-bot-neck { position: absolute; pointer-events: none; }
  /* 帽子和耳朵挂在脑袋顶部；领结挂在下巴，故意露一半在外面 */
  .qc-bot-hat, .qc-bot-ears { left: 0; top: 0; width: 38px; height: 0; }
  .qc-bot-neck { left: 50%; margin-left: -15px; bottom: -5px; width: 30px; height: 13px; }

  .qc-bot-hat > i, .qc-bot-ears > i, .qc-bot-neck > i {
    position: absolute; display: block;
    opacity: 0; transform: translateY(3px) scale(.85);
    transform-origin: 50% 100%;
    transition: opacity .2s ease, transform .3s cubic-bezier(.34,1.3,.64,1);
  }
  .qc-bot-hat > i svg, .qc-bot-ears > i svg, .qc-bot-neck > i svg {
    display: block; width: 100%; height: 100%; overflow: visible;
  }

  .qc-bot-hat > i[data-i="cap"] { left: -4px; top: -11px; width: 46px; height: 18px; color: var(--qc-b); }
  .qc-bot-hat > i[data-i="beanie"] { left: -3px; top: -12px; width: 44px; height: 20px; color: var(--qc-b); }
  .qc-bot-hat > i[data-i="crown"] { left: 2px; top: -9px; width: 34px; height: 14px; }
  .qc-bot-hat > i[data-i="grad"] { left: -2px; top: -12px; width: 42px; height: 20px; }
  .qc-bot-hat > i[data-i="santa"] { left: -3px; top: -12px; width: 44px; height: 20px; }
  .qc-bot-hat > i[data-i="witch"] { left: -4px; top: -17px; width: 46px; height: 26px; }
  /* 耳机是戴在两侧的，位置压得低一点，别飘在头顶 */
  .qc-bot-hat > i[data-i="phones"] { left: -6px; top: -3px; width: 50px; height: 24px; }

  .qc-bot-ears > i { color: var(--qc-a); }
  .qc-bot-ears > i[data-i="cat"] { left: -3px; top: -8px; width: 44px; height: 12px; }
  .qc-bot-ears > i[data-i="bunny"] { left: 1px; top: -20px; width: 36px; height: 24px; }
  /* 狗耳是垂的，起点比猫耳低，耳朵尖朝下；压暗一点才和脑袋分得开 */
  .qc-bot-ears > i[data-i="dog"] {
    left: -3px; top: -7px; width: 44px; height: 18px;
    filter: brightness(.8) saturate(1.15);
  }

  .qc-bot-neck > i[data-i="bow"],
  .qc-bot-neck > i[data-i="scarf"] { inset: 0; }
  .qc-bot-neck > i[data-i="tie"] { left: 50%; margin-left: -6.5px; top: -9px; width: 13px; height: 15px; }
  .qc-bot-neck > i[data-i="bell"] { left: 50%; margin-left: -8px; top: -6px; width: 16px; height: 14px; }

  .qc-bot[data-hat="cap"] .qc-bot-hat > i[data-i="cap"],
  .qc-bot[data-hat="beanie"] .qc-bot-hat > i[data-i="beanie"],
  .qc-bot[data-hat="crown"] .qc-bot-hat > i[data-i="crown"],
  .qc-bot[data-hat="grad"] .qc-bot-hat > i[data-i="grad"],
  .qc-bot[data-hat="santa"] .qc-bot-hat > i[data-i="santa"],
  .qc-bot[data-hat="witch"] .qc-bot-hat > i[data-i="witch"],
  .qc-bot[data-hat="phones"] .qc-bot-hat > i[data-i="phones"],
  .qc-bot[data-ears="cat"] .qc-bot-ears > i[data-i="cat"],
  .qc-bot[data-ears="bunny"] .qc-bot-ears > i[data-i="bunny"],
  .qc-bot[data-ears="dog"] .qc-bot-ears > i[data-i="dog"],
  .qc-bot[data-neck="bow"] .qc-bot-neck > i[data-i="bow"],
  .qc-bot[data-neck="scarf"] .qc-bot-neck > i[data-i="scarf"],
  .qc-bot[data-neck="tie"] .qc-bot-neck > i[data-i="tie"],
  .qc-bot[data-neck="bell"] .qc-bot-neck > i[data-i="bell"] {
    opacity: 1; transform: none;
  }

  /* 戴上帽子就把天线收起来，不然帽子上顶着一根铁丝 */
  .qc-bot:not([data-hat="none"]) .qc-bot-antenna {
    opacity: 0; transform: translateY(-3px) scaleY(.35);
  }
  /* 有帽子时蜘蛛网再往外让一点，别糊在帽檐上 */
  .qc-bot:not([data-hat="none"]) .qc-bot-web { right: -9px; top: -12px; }

  /* ============================================================
   * 小动作：全部挂在已有事件上，不额外加定时器
   * 统一走 transform / opacity，时长 0.5-1.6s，回落都带一点过冲
   * ============================================================ */
  .qc-bot-stamp, .qc-bot-count, .qc-bot-fly, .qc-bot-qmark {
    position: absolute; pointer-events: none; opacity: 0;
  }

  /* ② 答完一题：头顶弹一个数字球 */
  .qc-bot-count {
    top: -11px; right: -3px; min-width: 15px; height: 15px; padding: 0 3px;
    border-radius: 8px; background: #6ee7a8; color: #0b1220;
    font-size: 9px; font-weight: 700; line-height: 15px; text-align: center;
    box-shadow: 0 2px 6px rgba(0,0,0,.35);
  }
  .qc-bot[data-fx="count"] .qc-bot-count { animation: qc-count-pop .95s cubic-bezier(.34,1.56,.64,1) both; }

  @keyframes qc-count-pop {
    0%   { opacity: 0; transform: translateY(5px) scale(.35); }
    28%  { opacity: 1; transform: translateY(-7px) scale(1.2); }
    50%  { transform: translateY(-6px) scale(1); }
    100% { opacity: 0; transform: translateY(-14px) scale(.9); }
  }

  /* ③ 收工：盖个章。章必须是白的——完成状态整个脑袋是绿的，绿章会隐身 */
  .qc-bot-stamp {
    top: -4px; left: -8px; width: 24px; height: 24px;
    border: 2.5px solid rgba(255,255,255,.96); border-radius: 50%;
    background: rgba(255,255,255,.14);
    box-shadow: 0 1px 6px rgba(8,40,26,.35), inset 0 0 6px rgba(255,255,255,.4);
  }
  .qc-bot-stamp::before {
    content: ''; position: absolute; inset: 2px;
    border: 1px dashed rgba(255,255,255,.7); border-radius: 50%;
  }
  .qc-bot-stamp::after {
    content: '✓'; position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    color: #0d5138; font-size: 11px; font-weight: 800;
  }
  .qc-bot[data-state="done"] .qc-bot-stamp { animation: qc-stamp 2s cubic-bezier(.34,1.4,.64,1) both; }

  @keyframes qc-stamp {
    0%   { opacity: 0; transform: scale(2.4) rotate(-26deg); }
    10%  { opacity: 1; transform: scale(.82) rotate(-8deg); }
    15%  { transform: scale(1.08) rotate(-13deg); }
    20%  { transform: scale(1) rotate(-12deg); }
    24%  { transform: scale(1.04) rotate(-12deg); }
    28%  { transform: scale(1) rotate(-12deg); }
    74%  { opacity: 1; transform: scale(1) rotate(-12deg); }
    100% { opacity: 0; transform: scale(1.1) rotate(-12deg); }
  }

  /* ④ 填进页面：飞走一张小卡片 */
  .qc-bot-fly {
    top: 18px; left: 50%; margin-left: -6px; width: 12px; height: 14px;
    background: rgba(255,255,255,.92); border-radius: 2px;
    box-shadow: 0 2px 5px rgba(0,0,0,.3);
  }
  .qc-bot[data-fly="1"] .qc-bot-fly { animation: qc-fly .85s cubic-bezier(.4,.05,.6,1) both; }

  @keyframes qc-fly {
    0%   { opacity: 0; transform: translate(0,0) rotate(0) scale(.7); }
    16%  { opacity: 1; }
    100% { opacity: 0; transform: translate(-66px,-48px) rotate(-34deg) scale(.16); }
  }

  /* ⑤ 答案和解析对不上：歪头 + 问号 */
  .qc-bot-qmark {
    top: -10px; right: -2px; font-size: 13px; font-weight: 700;
    color: #ffd98a; text-shadow: 0 1px 3px rgba(0,0,0,.45);
  }
  .qc-bot[data-mood="confused"] .qc-bot-qmark { animation: qc-qmark 1.7s ease-out both; }
  /* 歪头必须写成 animation：head 上的呼吸动画占着 transform，普通声明会被盖掉 */
  .qc-bot[data-mood="confused"] .qc-bot-head { animation: qc-tilt-confused .5s cubic-bezier(.34,1.4,.64,1) both; }

  @keyframes qc-tilt-confused {
    0%   { transform: scale(1) rotate(0deg); }
    62%  { transform: scale(1) rotate(14deg); }
    100% { transform: scale(1) rotate(12deg); }
  }

  @keyframes qc-qmark {
    0%   { opacity: 0; transform: translateY(4px) scale(.5); }
    22%  { opacity: 1; transform: translateY(-2px) scale(1.16); }
    42%  { transform: translateY(-1px) scale(1) rotate(-7deg); }
    66%  { transform: translateY(-1px) scale(1) rotate(5deg); }
    100% { opacity: 0; transform: translateY(-7px) scale(1); }
  }

  /* ⑥ 跟丢光标：左右找人 */
  .qc-bot[data-mood="look"] .qc-bot-head { animation: qc-look-around 1.2s ease-in-out; }

  @keyframes qc-look-around {
    0%, 100% { transform: rotate(0); }
    22%      { transform: rotate(-7deg); }
    46%      { transform: rotate(6deg); }
    68%      { transform: rotate(-3deg); }
    86%      { transform: rotate(0); }
  }

  /* ⑦ 被滚屏晃到：后仰再回正 */
  .qc-bot[data-fx="sway"] .qc-bot-body { animation: qc-sway .5s ease-out; }

  @keyframes qc-sway {
    0%   { transform: skewX(0) translateY(0); }
    30%  { transform: skewX(-4deg) translateY(-1px); }
    62%  { transform: skewX(2deg) translateY(0); }
    100% { transform: skewX(0) translateY(0); }
  }

  /* ⑧ 戴帽子：帽子晚 80ms 落下（分层惯性） */
  .qc-bot[data-fx="wear"] .qc-bot-hat { animation: qc-hat-drop .62s cubic-bezier(.34,1.5,.64,1) .08s both; }
  .qc-bot[data-fx="wear"] .qc-bot-body { animation: qc-wear-hop .62s ease-out; }

  @keyframes qc-hat-drop {
    0%   { transform: translateY(-9px) scale(1.06); opacity: .35; }
    58%  { transform: translateY(1px) scale(.99); opacity: 1; }
    100% { transform: translateY(0) scale(1); opacity: 1; }
  }
  @keyframes qc-wear-hop {
    0%   { transform: translateY(0); }
    34%  { transform: translateY(-3px); }
    68%  { transform: translateY(0); }
    84%  { transform: translateY(-1px); }
    100% { transform: translateY(0); }
  }

  /* ⑨ 摸头时耳朵跟着抖 */
  .qc-bot[data-fx="earflick"] .qc-bot-ears { animation: qc-ear-flick .52s ease-in-out; }

  @keyframes qc-ear-flick {
    0%, 100% { transform: rotate(0); }
    24%      { transform: rotate(9deg); }
    50%      { transform: rotate(-6deg); }
    76%      { transform: rotate(3deg); }
  }

  /* ⑩ 围巾一直在飘：只戴着、且闲着的时候 */
  .qc-bot[data-state="idle"][data-neck="scarf"] .qc-bot-neck { animation: qc-scarf 3.4s ease-in-out infinite; }

  @keyframes qc-scarf {
    0%, 100% { transform: skewX(0) translateX(0); }
    34%      { transform: skewX(-4deg) translateX(-1px); }
    70%      { transform: skewX(3deg) translateX(1px); }
  }

  /* ⑪ 被挠痒 */
  .qc-bot[data-fx="tickle"] .qc-bot-body { animation: qc-tickle .55s ease-in-out; }

  @keyframes qc-tickle {
    0%, 100% { transform: translateX(0) scale(1); }
    20%      { transform: translateX(-3px) scale(.97); }
    46%      { transform: translateX(3px) scale(1.02); }
    72%      { transform: translateX(-2px) scale(.99); }
  }

  /* ⑫ 菜单弹出：探头看一眼（菜单本来就在它左边，不用挪位置） */
  .qc-bot[data-lookmenu="1"] .qc-bot-head { animation: qc-tilt-menu .42s cubic-bezier(.34,1.4,.64,1) both; }

  @keyframes qc-tilt-menu {
    0%   { transform: scale(1) rotate(0) translateY(0); }
    68%  { transform: scale(1) rotate(-11deg) translateY(-1.6px); }
    100% { transform: scale(1) rotate(-9deg) translateY(-1px); }
  }

  /* ⑬ 偷看头顶的计时牌：眼睛上瞟一下，头也跟着抬一点 */
  .qc-bot[data-mood="peek"] .qc-bot-eye { transform: translateY(-2px); }
  .qc-bot[data-mood="peek"] .qc-bot-head { animation: qc-tilt-peek .45s ease-out both; }

  @keyframes qc-tilt-peek {
    0%   { transform: scale(1) rotate(0) translateY(0); }
    70%  { transform: scale(1) rotate(-4deg) translateY(-1.6px); }
    100% { transform: scale(1) rotate(-3deg) translateY(-1px); }
  }

  /* ⑭ 伸懒腰：拉长再弹回来，眼睛眯成一条 */
  .qc-bot[data-mood="stretch"] .qc-bot-body { animation: qc-stretch 1.1s cubic-bezier(.34,1.3,.64,1); }
  .qc-bot[data-mood="stretch"] .qc-bot-eye { width: 7px; height: 2.5px; border-radius: 2px; }

  @keyframes qc-stretch {
    0%   { transform: scale(1, 1); }
    30%  { transform: scale(.97, 1.06) translateY(-1px); }
    56%  { transform: scale(1.01, .99); }
    76%  { transform: scale(1, 1.01); }
    100% { transform: scale(1, 1); }
  }

  @media (prefers-reduced-motion: reduce) {
    .qc-bot-body, .qc-bot-head, .qc-bot-eyes, .qc-bot-eye,
    .qc-bot-antenna::after, .qc-bot-tick path, .qc-bot-zzz i,
    .qc-bot-heart, .qc-bot-spiral, .qc-bot-spiral svg,
    .qc-bot-stamp, .qc-bot-count, .qc-bot-fly, .qc-bot-qmark,
    .qc-bot-hat, .qc-bot-ears, .qc-bot-neck { animation: none !important; }
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

  /* 右上角的蜘蛛网：以方框右上角为圆心向左侧铺开，三层弧，末端挂只小蜘蛛 */
  const WEB_SVG = (() => {
    const CX = 24, CY = 0, R = 23;
    const angs = [180, 157.5, 135, 112.5, 90].map((d) => (d * Math.PI) / 180);
    const pt = (a, r) => [CX + Math.cos(a) * r, CY + Math.sin(a) * r];
    const f = (n) => Number(n.toFixed(1));
    let d = '';
    angs.forEach((a) => {
      const p = pt(a, R);
      d += 'M' + CX + ' ' + CY + 'L' + f(p[0]) + ' ' + f(p[1]);
    });
    [7, 13, 19].forEach((r) => {
      for (let i = 0; i < angs.length - 1; i++) {
        const a = pt(angs[i], r);
        const b = pt(angs[i + 1], r);
        // 控制点往圆心收一点，弧看起来才有下坠感
        const mx = CX + ((a[0] + b[0]) / 2 - CX) * 0.8;
        const my = CY + ((a[1] + b[1]) / 2 - CY) * 0.8;
        d += 'M' + f(a[0]) + ' ' + f(a[1]) + 'Q' + f(mx) + ' ' + f(my) + ' ' + f(b[0]) + ' ' + f(b[1]);
      }
    });
    const spider =
      '<g transform="translate(16.6 9.4)"><g class="qc-web-spider">' +
      '<circle r="1.9" fill="#1b202a" stroke="rgba(236,242,252,.7)" stroke-width=".45"/>' +
      '<circle cy="-2.2" r="1.15" fill="#1b202a" stroke="rgba(236,242,252,.7)" stroke-width=".45"/>' +
      '<path d="M-1.2 -.3L-3 -1.6M-1.4 .3L-3.2 .9M-1 1.1L-2.7 2.5' +
      'M1.2 -.3L3 -1.6M1.4 .3L3.2 .9M1 1.1L2.7 2.5"/>' +
      '</g></g>';
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '"/>' + spider + '</svg>';
  })();

  /* ---------- 换装：帽子 / 耳朵 / 领结 ----------
     全部挂在 .qc-bot-head 里面，这样能跟着呼吸、歪头、干完活抖一下一起动；
     放外面的话帽子会浮在一个正在呼吸的脑袋上，一眼假。
     SVG 用 currentColor 取皮肤色，具体颜色在 CSS 里按配件指定。 */
  const WEAR_KINDS = ['hat', 'ears', 'neck'];
  const WEAR_ITEMS = {
    hat: ['none', 'cap', 'beanie', 'crown', 'grad', 'santa', 'witch', 'phones'],
    ears: ['none', 'cat', 'bunny', 'dog'],
    neck: ['none', 'bow', 'scarf', 'tie', 'bell']
  };
  const WEAR_CN = {
    hat: {
      none: '不戴',
      cap: '棒球帽',
      beanie: '毛线帽',
      crown: '小皇冠',
      grad: '学士帽',
      santa: '圣诞帽',
      witch: '女巫帽',
      phones: '耳机'
    },
    ears: { none: '不戴', cat: '猫耳', bunny: '兔耳', dog: '狗耳' },
    neck: { none: '不戴', bow: '领结', scarf: '围巾', tie: '领带', bell: '铃铛' }
  };

  const HAT_SVG = {
    cap:
      '<svg viewBox="0 0 46 18" aria-hidden="true">' +
      '<path d="M6 14.2a16 12 0 0 1 32 0z" fill="currentColor"/>' +
      '<path d="M32.6 13.4c6.2.2 11.2 1.7 13 3.8-4.4 1.8-11.4 1.9-16 .7z" fill="currentColor"/>' +
      '<path d="M32.6 14.9c5.4.3 9.6 1.4 11.4 2.9-3.8 1.2-9.2 1.2-13 .3z" fill="#000" opacity=".18"/>' +
      '<circle cx="22" cy="4.6" r="1.7" fill="#fff" opacity=".8"/>' +
      '</svg>',
    beanie:
      '<svg viewBox="0 0 44 20" aria-hidden="true">' +
      '<path d="M8 14.4a14 12 0 0 1 28 0z" fill="currentColor"/>' +
      '<rect x="5.6" y="12.4" width="32.8" height="4.8" rx="2.4" fill="currentColor"/>' +
      '<rect x="5.6" y="12.4" width="32.8" height="4.8" rx="2.4" fill="#000" opacity=".16"/>' +
      '<circle cx="22" cy="3" r="3.1" fill="#fff" opacity=".92"/>' +
      '</svg>',
    crown:
      '<svg viewBox="0 0 34 14" aria-hidden="true">' +
      '<path d="M3 12.2L4.7 3.5l6 4.4L17 1.2l6.3 6.7 6-4.4L31 12.2z" fill="#fbbf24" ' +
      'stroke="#d9a406" stroke-width=".7" stroke-linejoin="round"/>' +
      '<circle cx="17" cy="9.4" r="1.5" fill="#fff6c9"/>' +
      '</svg>',
    grad:
      '<svg viewBox="0 0 42 20" aria-hidden="true">' +
      '<path d="M14 10.4v4.2c0 1.7 3.1 2.9 7 2.9s7-1.2 7-2.9v-4.2z" fill="#232a36"/>' +
      '<path d="M21 2.6l16 5.2-16 5.2L5 7.8z" fill="#2f3644"/>' +
      '<path d="M21 2.6l16 5.2-16 1.6z" fill="#3c4557"/>' +
      '<path d="M35.6 8.4v7.2" stroke="#fbbf24" stroke-width="1.1"/>' +
      '<circle cx="35.6" cy="17" r="1.8" fill="#fbbf24"/>' +
      '</svg>',
    santa:
      '<svg viewBox="0 0 44 20" aria-hidden="true">' +
      '<path d="M7.4 14.2C9.6 6.2 18.2 1 27.8 3.2 34.2 4.6 38 8.4 38.8 14.2z" fill="#e23a4b"/>' +
      '<path d="M12.6 11.8C14.8 6.8 20.6 4 26.4 4.8" stroke="#ff7280" stroke-width="2" fill="none" ' +
      'opacity=".55" stroke-linecap="round"/>' +
      '<rect x="3.6" y="12.6" width="36" height="5.8" rx="2.9" fill="#fff"/>' +
      '<rect x="3.6" y="15.6" width="36" height="2.8" rx="1.4" fill="#dbe3f0"/>' +
      '<circle cx="38.4" cy="8" r="3.5" fill="#fff"/>' +
      '<circle cx="37.5" cy="7.1" r="1.3" fill="#eef3fb"/>' +
      '</svg>',
    witch:
      '<svg viewBox="0 0 46 26" aria-hidden="true">' +
      '<ellipse cx="23" cy="21.6" rx="18" ry="4.2" fill="#463a86"/>' +
      '<path d="M11.8 20.6C14.8 12.4 19.6 5.2 26.8 2c-2.7 5.6-3.6 11.8-3.2 18.6z" fill="#5b4bb0"/>' +
      '<path d="M26.8 2c3.7-1.1 5.8 1.5 4.2 4.5" stroke="#5b4bb0" stroke-width="2.6" fill="none" ' +
      'stroke-linecap="round"/>' +
      '<path d="M13.6 17.2h12.4l1 3.3H12.6z" fill="#fbbf24"/>' +
      '<circle cx="30.6" cy="4.2" r="1.8" fill="#f6d365"/>' +
      '</svg>',
    phones:
      '<svg viewBox="0 0 48 22" aria-hidden="true">' +
      '<path d="M8 17.6C8 8.6 15 3.2 24 3.2s16 5.4 16 14.4" stroke="#2f3646" stroke-width="3.4" ' +
      'fill="none" stroke-linecap="round"/>' +
      '<rect x="3" y="13.2" width="9.2" height="8.2" rx="4.3" fill="#3b4454"/>' +
      '<rect x="35.8" y="13.2" width="9.2" height="8.2" rx="4.3" fill="#3b4454"/>' +
      '<rect x="5.3" y="15.3" width="4.6" height="4.2" rx="2.1" fill="#7f8da6"/>' +
      '<rect x="38.1" y="15.3" width="4.6" height="4.2" rx="2.1" fill="#7f8da6"/>' +
      '</svg>'
  };

  const EARS_SVG = {
    cat:
      '<svg viewBox="0 0 44 12" aria-hidden="true">' +
      '<path d="M4 11.4L7.6 1l9 8.2z" fill="currentColor"/>' +
      '<path d="M40 11.4L36.4 1l-9 8.2z" fill="currentColor"/>' +
      '<path d="M8.2 9.8l2-5 4.2 3.6z" fill="#ff9db8" opacity=".78"/>' +
      '<path d="M35.8 9.8l-2-5-4.2 3.6z" fill="#ff9db8" opacity=".78"/>' +
      '</svg>',
    bunny:
      '<svg viewBox="0 0 36 24" aria-hidden="true">' +
      '<ellipse cx="11" cy="10" rx="4.8" ry="9.6" fill="currentColor" transform="rotate(-13 11 10)"/>' +
      '<ellipse cx="25" cy="10" rx="4.8" ry="9.6" fill="currentColor" transform="rotate(13 25 10)"/>' +
      '<ellipse cx="11" cy="10" rx="2.2" ry="6.2" fill="#ff9db8" opacity=".74" transform="rotate(-13 11 10)"/>' +
      '<ellipse cx="25" cy="10" rx="2.2" ry="6.2" fill="#ff9db8" opacity=".74" transform="rotate(13 25 10)"/>' +
      '</svg>',
    dog:
      '<svg viewBox="0 0 44 18" aria-hidden="true">' +
      '<ellipse cx="6.6" cy="9.4" rx="5" ry="8" fill="currentColor" transform="rotate(-10 6.6 9.4)"/>' +
      '<ellipse cx="37.4" cy="9.4" rx="5" ry="8" fill="currentColor" transform="rotate(10 37.4 9.4)"/>' +
      '<ellipse cx="6.8" cy="10.2" rx="2.1" ry="4.6" fill="#c98d6a" opacity=".6" transform="rotate(-10 6.8 10.2)"/>' +
      '<ellipse cx="37.2" cy="10.2" rx="2.1" ry="4.6" fill="#c98d6a" opacity=".6" transform="rotate(10 37.2 10.2)"/>' +
      '</svg>'
  };

  const NECK_SVG = {
    bow:
      '<svg viewBox="0 0 24 14" aria-hidden="true">' +
      '<path d="M11 7L1.2 2.4v9.2z" fill="#ff5f8a"/>' +
      '<path d="M13 7l9.8-4.6v9.2z" fill="#ff5f8a"/>' +
      '<circle cx="12" cy="7" r="3" fill="#e8416f"/>' +
      '<circle cx="12" cy="7" r="1.2" fill="#fff" opacity=".4"/>' +
      '</svg>',
    scarf:
      '<svg viewBox="0 0 30 13" aria-hidden="true">' +
      '<path d="M.6 5.2Q2 1.6 7 1.6h16q5 0 6.4 3.6l-1.8 5.6Q15 12.6 2.4 10.8z" fill="#34d399"/>' +
      '<path d="M.6 5.2Q2 1.6 7 1.6h16q5 0 6.4 3.6l-.5 1.5H1.1z" fill="#25a87a"/>' +
      '<path d="M18.6 7.6c.1 2 .1 3.4 0 5.1l3.5-1.2V8.1z" fill="#2bb584"/>' +
      '</svg>',
    tie:
      '<svg viewBox="0 0 14 20" aria-hidden="true">' +
      '<path d="M4.2 1h5.6l1 3.2-3.8 1.8L3.2 4.2z" fill="#2f3f6b"/>' +
      '<path d="M4.4 5.6h5.2l1.2 9.4L7 19.4l-3.8-4.4z" fill="#3b5bdb"/>' +
      '<path d="M7 6.4v12.2" stroke="#2b46a8" stroke-width=".8" opacity=".7"/>' +
      '</svg>',
    bell:
      '<svg viewBox="0 0 16 18" aria-hidden="true">' +
      '<path d="M8 1.2v2.2" stroke="#e23a4b" stroke-width="1.6" stroke-linecap="round"/>' +
      '<path d="M8 3.4c-3 0-4.6 2.6-4.6 5.6h9.2c0-3-1.6-5.6-4.6-5.6z" fill="#fbbf24"/>' +
      '<path d="M4.2 7.2c.5-2 1.9-3.2 3.8-3.2" stroke="#ffd98a" stroke-width="1" fill="none" opacity=".8"/>' +
      '<rect x="2.6" y="8.8" width="10.8" height="2.2" rx="1.1" fill="#e0a006"/>' +
      '<circle cx="8" cy="12.9" r="1.7" fill="#e0a006"/>' +
      '</svg>'
  };

  const wearHtml = (kind, map) =>
    WEAR_ITEMS[kind]
      .filter((k) => k !== 'none')
      .map((k) => '<i data-i="' + k + '">' + (map[k] || '') + '</i>')
      .join('');

  const HAT_HTML = wearHtml('hat', HAT_SVG);
  const EARS_HTML = wearHtml('ears', EARS_SVG);
  const NECK_HTML = wearHtml('neck', NECK_SVG);

  /* 机器人本体结构：衣橱的预览也复用它，省得两处各写一份 */
  /* 纸飞机：一张折过的纸，右下角带折痕 */
  const PLANE_SVG =
    '<svg viewBox="0 0 36 24" aria-hidden="true">' +
    '<path d="M2.2 11.4 33.4 2.2 23.2 21.6l-6.4-7.6z" fill="#f7fbff" stroke="#b9cbe4" ' +
    'stroke-width="1" stroke-linejoin="round"/>' +
    '<path d="M16.8 14 33.4 2.2 23.2 21.6z" fill="#dbe8f8"/>' +
    '<path d="M16.8 14l1.6 5.2" stroke="#b9cbe4" stroke-width=".9" stroke-linecap="round"/>' +
    '</svg>';

  const BOT_INNER =
    '<span class="qc-bot-body">' +
    '<span class="qc-bot-antenna"></span>' +
    '<span class="qc-bot-head">' +
    '<span class="qc-bot-ears">' + EARS_HTML + '</span>' +
    '<span class="qc-bot-eyes"><span class="qc-bot-eye"></span><span class="qc-bot-eye"></span></span>' +
    '<span class="qc-bot-blush"><i></i><i></i></span>' +
    '<span class="qc-bot-spiral"><svg viewBox="0 0 10 10" aria-hidden="true"><path d="' + SPIRAL + '"/></svg><svg viewBox="0 0 10 10" aria-hidden="true"><path d="' + SPIRAL + '"/></svg></span>' +
    '<span class="qc-bot-zzz"><i>z</i><i>z</i><i>z</i></span>' +
    '<span class="qc-bot-hearts"><i class="qc-bot-heart"></i><i class="qc-bot-heart"></i><i class="qc-bot-heart"></i></span>' +
    '<span class="qc-bot-neck">' + NECK_HTML + '</span>' +
    '<span class="qc-bot-hat">' + HAT_HTML + '</span>' +
    '<span class="qc-bot-web">' + WEB_SVG + '</span>' +
    '<span class="qc-bot-count"></span>' +
    '<span class="qc-bot-stamp"></span>' +
    '<span class="qc-bot-fly"></span>' +
    '<span class="qc-bot-qmark">?</span>' +
    '<svg class="qc-bot-tick" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 12.5 L10 17 L18.5 7.5"/></svg>' +
    '</span></span>' +
    '<span class="qc-ball"><i></i></span>' +
    '<span class="qc-car"><i class="qc-car-body"></i><i class="qc-car-cab"></i>' +
    '<i class="qc-car-w1"></i><i class="qc-car-w2"></i></span>' +
    '<span class="qc-plane">' + PLANE_SVG + '</span>' +
    '<span class="qc-door"><i class="qc-door-panel"></i><i class="qc-door-knob"></i></span>' +
    '<span class="qc-spark"><i></i><i></i><i></i><i></i><i></i><i></i></span>' +
    '<span class="qc-ring"></span>' +
    '<span class="qc-pomo"><span class="qc-pomo-t"></span><span class="qc-pomo-bar"><i></i></span></span>' +
    '<span class="qc-bot-bubble"><span class="qc-bot-bubble-txt"></span></span>';

  /* 交互参数 */
  const FOLLOW_R = 220;      // 鼠标进入这个半径，眼睛开始跟
  const WAKE_R = 150;        // 睡着的它，鼠标走到这么近会惊醒
  const DIZZY_SPEED = 1200;  // 拖动速度超过这个值（px/s）会晕
  const DIZZY_WINDOW = 1600; // 判定画圈的时间窗
  const DOUBLE_MS = 280;     // 两次点击间隔小于它算双击
  const TAP_CHAIN_MS = 520;  // 这个时间内接着点，算同一串连击
  const TAP_GAP_MS = 220;    // 双击先等这么久，确认不是三击
  const DIZZY_INERTIA = 1100; // 松手后靠惯性继续晕多久
  const DAZE_SHAKE = 1150;   // 摇头本身的时长：幅度一下比一下小，最后停住
  const DAZE_HOLD = 520;     // 停住之后保持 >< 的时长，再恢复
  const DAZE_MS = DAZE_SHAKE + DAZE_HOLD;
  const HOVER_TILT_MS = 1700;  // 悬停这么久还没人点，就歪头好奇
  const PET_STROKE_MS = 2600;  // 摸头判定的时间窗
  const PET_STROKES = 4;       // 窗口内来回这么多次算摸头
  const PET_IDLE_MS = 1100;    // 停下这么久就结束摸头
  const SWEEP_WINDOW = 1500;   // 镜像扫视的判定窗口
  const WEB_AFTER = 90000;     // 多久没人理它就结网（比睡着晚 40 秒，睡着也照样结）
  const WEB_RETRY = 8000;      // 时间到了但有表情/在忙，过这么久再看一眼

  /* 待机时随机换的表情（权重加起来 0.52，剩下 48% 就是单纯眨个眼） */
  const IDLE_MOODS = [
    { k: 'happy', ms: 1200, w: 0.22 },
    { k: 'wink', ms: 900, w: 0.12 },
    { k: 'sad', ms: 1100, w: 0.1 },
    { k: 'surprised', ms: 800, w: 0.08 }
  ];

  /* 表情退场的「尾巴」有多长：先把幅度收小、附属元素淡掉，再真正摘掉表情 */
  const MOOD_TAIL = {
    pet: 920,
    yawn: 620,
    daze: 420,
    happy: 300,
    wink: 300,
    sad: 300,
    angry: 300,
    surprised: 300
  };

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  /* 台词统一从 81-lines 拿；拿不到就用兜底那句，保证不会哑 */
  const L = (name, fb) => (Q.lines && Q.lines.pick ? Q.lines.pick(name, fb) : (fb || ''));

  let el = null;
  let bubbleTimer = null;
  let idleTimer = null;
  let moodTimer = null;
  let tailTimer = null;
  let sleepTimer = null;
  let yawnTimer = null;
  let peekTimer = null;   // 闲着的时候偷看一眼头顶的计时牌
  let hoverTimer = null;
  let webTimer = null;
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
  let lastTapY = 0;   // 上一次点在自己的哪个高度（判断是不是点在肚子上）
  let lastTapH = 0;
  let petSamples = [];
  let petting = false;
  let petEndTimer = null;
  let sweepSamples = [];
  let sweepUntil = 0;
  let webOn = false;
  let webRetry = WEB_RETRY;
  let lastPetSay = 0;

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
        if (typeof p.left === 'number' && typeof p.top === 'number') {
          moveTo(p.left, p.top);
          placeBubble();
        }
      });
    } catch (e) {}
  }

  function onResize() {
    if (!el || !el.style.left) return;
    const r = el.getBoundingClientRect();
    moveTo(r.left, r.top);
  }

  function restoreSkin() {
    try {
      chrome.storage.sync.get({ botSkin: 'blue' }, (cfg) => {
        if (el && cfg && cfg.botSkin) setSkin(cfg.botSkin);
      });
    } catch (e) {}
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

    el.style.transition = 'left .3s cubic-bezier(.3,1.28,.55,1), top .3s cubic-bezier(.3,1.28,.55,1)';
    moveTo(left, top);
    setTimeout(() => {
      if (el) el.style.transition = '';
    }, 320);
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
    say(L('wake', '！'), 700, false);
    startIdle();
    // 睡到结网被吵醒：先「！」一下，再把网抖掉
    if (webOn) setTimeout(() => { if (el && webOn) clearWeb(); }, 700);
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

    // 在它面前快速左右扫鼠标 → 它会跟着扫到晕
    if (el && !drag && !petting && el.dataset.state === 'idle' && !el.dataset.mood) {
      const b = el.getBoundingClientRect();
      const near = Math.hypot(e.clientX - (b.left + b.width / 2), e.clientY - (b.top + b.height / 2)) < FOLLOW_R * 1.4;
      if (near) feedSweep(e.clientX, Date.now());
      else if (sweepSamples.length) sweepSamples = [];
    }

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
    say(L('dizzy', '晕…'), 1500, false);
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
    say(L('daze', '……'), DAZE_MS, false);
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

  /* ---------- 摸头：悬停在它身上左右来回蹭 ---------- */
  /* 只记「有效位移」，鼠标抖 1~2px 不算数，免得随便动一下就以为在摸 */
  function feedPet(x, now) {
    const last = petSamples[petSamples.length - 1];
    if (last) {
      const d = x - last.x;
      last.t = now;
      if (Math.abs(d) < 6) return;
    }
    petSamples.push({ x, t: now, dir: last ? (x > last.x ? 1 : -1) : 0 });
    while (petSamples.length && now - petSamples[0].t > PET_STROKE_MS) petSamples.shift();

    let turns = 0;
    for (let i = 1; i < petSamples.length; i++) {
      const a = petSamples[i - 1].dir;
      const b = petSamples[i].dir;
      if (a && b && a !== b) turns++;
    }
    if (turns + 1 >= PET_STROKES) startPet();
  }

  function startPet() {
    if (!el || drag || prefersReduced()) return;
    if (el.dataset.state !== 'idle') return;
    if (el.dataset.mood === 'sleepy') wake();
    petSamples = [];
    if (!petting) {
      petting = true;
      stopHover();
      setMood('pet', 0);
      if (getWear().ears !== 'none') playFx('earflick', 520);
      say(L('pet', '嘿嘿…'), 0, false);
      lastPetSay = Date.now();
    } else if (Date.now() - lastPetSay > 2600) {
      // 摸久了换一句，别一句话挂在那儿半天
      lastPetSay = Date.now();
      say(L('pet', '嘿嘿…'), 0, false);
    }
    if (petEndTimer) clearTimeout(petEndTimer);
    petEndTimer = setTimeout(() => endPet(false), PET_IDLE_MS);
  }

  function endPet(quiet) {
    petting = false;
    petSamples = [];
    if (petEndTimer) { clearTimeout(petEndTimer); petEndTimer = null; }
    if (!el) return;
    if (el.dataset.mood === 'pet') {
      // 走 920ms 的收尾：摇摆幅度递减、爱心飘散、腮红褪掉，而不是瞬间换脸
      clearMood();
      if (!quiet) say(L('petEnd', '舒服…'), 1100, false);
    }
  }

  /* ---------- 好奇：悬停一会儿不动手，它就歪头看你 ---------- */
  function stopHover() {
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
    if (!el || el.dataset.tilt !== '1') return;
    // 不是立刻立正：先转过头一点点，再摆回来
    el.dataset.tilt = 'out';
    setTimeout(() => {
      if (el && el.dataset.tilt === 'out') delete el.dataset.tilt;
    }, 520);
  }

  function startHover() {
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
    if (prefersReduced()) return;
    if (el && el.dataset.tilt === 'out') delete el.dataset.tilt;
    hoverTimer = setTimeout(() => {
      hoverTimer = null;
      if (!el || drag || petting) return;
      if (el.dataset.state !== 'idle' || el.dataset.mood) return;
      el.dataset.tilt = '1';
      hoverTimer = setTimeout(() => {
        hoverTimer = null;
        if (el) delete el.dataset.tilt;
      }, 2800);
    }, HOVER_TILT_MS);
  }

  /* ---------- 结网：很久没人理，身上结一层蜘蛛网，一碰就散 ---------- */
  /* 睡着也算「没人理」——它睡到长网，比醒着长网更像那回事 */
  function scheduleWeb(delay) {
    if (webTimer) { clearTimeout(webTimer); webTimer = null; }
    if (prefersReduced()) return;
    webTimer = setTimeout(() => {
      webTimer = null;
      if (!el) return;
      // 正在干活（解题、滚球、被拖）就先放过，过会儿再看
      if (drag || el.dataset.state !== 'idle') { scheduleWeb(webRetry); return; }
      // 有表情：困、打哈欠、开心这些都会挡网，等它做完再来，别一枪打空就再也不管
      const mood = el.dataset.mood;
      if (mood && mood !== 'sleepy') { scheduleWeb(webRetry); return; }
      growWeb();
    }, delay == null ? WEB_AFTER : delay);
  }

  /* 长网（也留给预览页/测试手动触发） */
  function growWeb(quiet) {
    if (!el) return;
    webOn = true;
    el.dataset.web = '1';
    // 睡着的时候不出声：睡梦里报「都长蜘蛛网了」很奇怪，等醒了再说
    if (!quiet && el.dataset.mood !== 'sleepy') say(L('web', '都长蜘蛛网了'), 4200, false);
  }

  function clearWeb() {
    if (!el || !webOn) return;
    webOn = false;
    if (webTimer) { clearTimeout(webTimer); webTimer = null; }
    el.dataset.web = 'clear';
    say(L('webClear', '呼，清爽了'), 1600, false);
    setTimeout(() => {
      if (el && el.dataset.web === 'clear') delete el.dataset.web;
    }, 540);
    scheduleWeb();   // 抖掉之后重新数：再没人理，过一会儿还会结
  }

  /* ---------- 镜像扫视：你在它面前快速左右晃鼠标，它跟着扫，然后自己晕了 ---------- */
  function feedSweep(x, now) {
    if (now < sweepUntil) return;
    const last = sweepSamples[sweepSamples.length - 1];
    if (last && Math.abs(x - last.x) < 3) return;
    sweepSamples.push({ x, t: now });
    while (sweepSamples.length && now - sweepSamples[0].t > SWEEP_WINDOW) sweepSamples.shift();
    if (sweepSamples.length < 4) return;

    let turns = 0;
    for (let i = 2; i < sweepSamples.length; i++) {
      const a = sweepSamples[i - 1].x - sweepSamples[i - 2].x;
      const b = sweepSamples[i].x - sweepSamples[i - 1].x;
      if (Math.abs(a) < 26 || Math.abs(b) < 26) continue;
      if ((a > 0) !== (b > 0)) turns++;
    }
    if (turns < 3) return;

    sweepSamples = [];
    sweepUntil = now + 7000;
    makeDizzy();
    say(L('shake', '别晃啦…'), 1800, false);
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

  /* ---------- 变成小球，滚过去再变回来 ---------- */
  let rolling = false;
  let rollOrigin = null;

  function rollToXY(tx, ty) {
    return new Promise((resolve) => {
      if (!el) return resolve();

      const from = el.getBoundingClientRect();
      const dx = tx - from.left;
      const dy = ty - from.top;
      const dist = Math.hypot(dx, dy);
      // 0.42px/ms 左右：600px 大概 1.4 秒，慢一点更像「走过去」而不是弹过去
      const dur = Math.max(560, Math.min(1800, dist / 0.42));
      const R = 17;   // 球半径，转过的弧度 = 位移 / 半径
      // 往左滚就逆时针，往右滚就顺时针；竖着走用纵向位移给一点滚动感
      const axis = Math.abs(dx) >= Math.abs(dy) ? dx : dy * 0.9;
      const t0 = performance.now();

      let finished = false;
      let watchdog = null;

      const place = (e) => {
        if (!el) return;
        el.style.left = from.left + dx * e + 'px';
        el.style.top = from.top + dy * e + 'px';
        el.style.setProperty('--qc-roll', (axis * e) / R + 'rad');
      };

      const end = () => {
        if (finished) return;
        finished = true;
        if (watchdog) clearTimeout(watchdog);
        resolve();
      };

      const step = (t) => {
        if (finished) return;
        const p = Math.min(1, (t - t0) / dur);
        // 起停缓一点，中间匀速，看起来才像滚
        const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        place(e);
        if (p < 1) requestAnimationFrame(step);
        else end();
      };

      // 兜底：某些环境（后台标签页、无头浏览器）rAF 不跑，别把 await 卡死
      watchdog = setTimeout(() => {
        place(1);
        end();
      }, dur + 600);

      requestAnimationFrame(step);
    });
  }

  /* ---------------- 赶路方式：每次随机挑一种 ---------------- */
  const TRAVELS = ['ball', 'car', 'plane', 'portal', 'magic', 'blink'];
  let lastTravel = '';

  function pickTravel() {
    const pool = TRAVELS.filter((t) => t !== lastTravel);
    const m = pool[Math.floor(Math.random() * pool.length)] || 'ball';
    lastTravel = m;
    return m;
  }

  const easeInOut = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

  /* 通用补间：带看门狗，后台标签页 / 无头浏览器 rAF 不跑也不会把 await 卡死 */
  function tween(dur, fn) {
    return new Promise((resolve) => {
      const t0 = performance.now();
      let done = false;
      let wd = null;
      const end = () => {
        if (done) return;
        done = true;
        if (wd) clearTimeout(wd);
        resolve();
      };
      const step = (t) => {
        if (done) return;
        const p = Math.min(1, (t - t0) / dur);
        fn(p);
        if (p < 1) requestAnimationFrame(step);
        else end();
      };
      wd = setTimeout(() => {
        fn(1);
        end();
      }, dur + 500);
      requestAnimationFrame(step);
    });
  }

  /* 从当前位置赶到 (tx, ty)。forceMode 不给就随机 */
  async function travelTo(tx, ty, forceMode) {
    if (!el) return;
    const from = el.getBoundingClientRect();
    const dx = tx - from.left;
    const dy = ty - from.top;
    const dist = Math.hypot(dx, dy);
    const mode = forceMode || pickTravel();

    const setPos = (x, y) => {
      if (!el) return;
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    };

    /* ① 化成球滚过去（原来那套） */
    if (mode === 'ball') {
      el.dataset.form = 'ball';
      await wait(230);
      await rollToXY(tx, ty);
      if (el) {
        delete el.dataset.form;
        el.style.removeProperty('--qc-roll');
      }
      hop();
      return;
    }

    el.dataset.travel = mode;

    /* ② 开车：直线，一路小颠 */
    if (mode === 'car') {
      // 0.36px/ms：600px 约 1.7 秒，急加速容易显得慌
      const dur = Math.max(760, Math.min(2400, dist / 0.36));
      await tween(dur, (p) => {
        const e = easeInOut(p);
        setPos(from.left + dx * e, from.top + dy * e);
        if (el) el.style.setProperty('--qc-bump', (Math.sin(p * Math.PI * 6) * 1.6).toFixed(2) + 'px');
      });
      if (el) {
        delete el.dataset.travel;
        el.style.removeProperty('--qc-bump');
      }
      hop();
      return;
    }

    /* ③ 纸飞机：走一条向上的弧线，机身跟着切线转 */
    if (mode === 'plane') {
      // 0.3px/ms：比车再慢一点，滑翔感才出得来
      const dur = Math.max(950, Math.min(2800, dist / 0.3));
      const mx = (from.left + tx) / 2;
      const my = Math.min(from.top, ty) - Math.min(150, 50 + dist * 0.3);
      await tween(dur, (p) => {
        const e = easeInOut(p);
        const x = (1 - e) * (1 - e) * from.left + 2 * (1 - e) * e * mx + e * e * tx;
        const y = (1 - e) * (1 - e) * from.top + 2 * (1 - e) * e * my + e * e * ty;
        setPos(x, y);
        const tanX = 2 * (1 - e) * (mx - from.left) + 2 * e * (tx - mx);
        const tanY = 2 * (1 - e) * (my - from.top) + 2 * e * (ty - my);
        if (el) el.style.setProperty('--qc-fly', ((Math.atan2(tanY, tanX) * 180) / Math.PI).toFixed(1) + 'deg');
      });
      if (el) {
        delete el.dataset.travel;
        el.style.removeProperty('--qc-fly');
      }
      hop();
      return;
    }

    /* ④⑤⑥ 任意门 / 魔法 / 瞬移：原地消失 → 瞬移 → 目的地出现 */
    el.dataset.tph = '1';
    await wait(mode === 'blink' ? 300 : 560);
    setPos(tx, ty);
    if (el) {
      delete el.dataset.tph;
      void el.offsetWidth; // 强制重排，第二段动画才会重新播
      el.dataset.tph = '2';
    }
    await wait(mode === 'blink' ? 620 : 720);
    if (el) {
      delete el.dataset.tph;
      delete el.dataset.travel;
    }
    hop();
  }

  /* 滚到某个矩形旁边（选区上方，贴顶就换到下方） */
  async function rollTo(rect) {
    if (!el || rolling || !rect) return false;
    if (prefersReduced()) return false;

    rolling = true;
    const from = el.getBoundingClientRect();
    rollOrigin = { left: from.left, top: from.top };

    const w = from.width;
    const h = from.height;
    let tx = rect.left + rect.width / 2 - w / 2;
    let ty = rect.top - h - 10;
    if (ty < 8) ty = Math.min(window.innerHeight - h - 8, rect.bottom + 10);
    tx = Math.max(8, Math.min(window.innerWidth - w - 8, tx));

    el.dataset.busy = '1';
    await travelTo(tx, ty);
    if (el) delete el.dataset.busy;
    rolling = false;
    placeBubble();
    return true;
  }

  /* 解释完了自己滚回原位（回去这趟固定用球，别让人追着看第二段动画） */
  async function rollHome() {
    if (!el || rolling || !rollOrigin) return;
    const o = rollOrigin;
    rollOrigin = null;
    rolling = true;
    el.dataset.busy = '1';
    await travelTo(o.left, o.top, 'ball');
    if (el) delete el.dataset.busy;
    rolling = false;
    placeBubble();
  }

  /* 连点三下及以上：不高兴，不解题 */
  function tripleTap() {
    if (!el) return;
    setMood('angry', 1000);
    say(L('triple', '戳我干嘛…'), 1300, false);
  }

  /* 双击：蹦一下 + 开心，不当成一键解题；点在下半身就变成「挠痒」 */
  function doubleTap() {
    if (!el) return;
    hop();
    if (el.dataset.state === 'idle') setMood('happy', 800);
    if (lastTapH && lastTapY > lastTapH * 0.62) {
      playFx('tickle', 560);
      say(L('tickle', '痒！别挠那儿'), 1100, false);
      return;
    }
    say(L('double', '嘿嘿'), 900, false);
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
    placeBubble();
    setTimeout(() => {
      if (el) el.style.transition = '';
    }, 650);
    setTimeout(savePos, 630);
    scheduleWander();
  }

  /* ---------- 拖拽 ---------- */
  function onDown(e) {
    if (!el) return;
    if (el.dataset.busy === '1') return;   // 滚球动画期间不接受拖拽
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
    placeBubble();
    if (el) {
      // 刚被甩晕的话，走惯性 → 闭眼甩头，别立刻换笑脸
      if (el.dataset.mood === 'dizzy') {
        settleDizzy();
      } else {
        setMood('happy', 900);
        say(L('drop', '放这儿啦'), 1400, false);
      }
    }
  }

  /* ---------- 悬停 ---------- */
  function onEnter() {
    if (!el) return;
    cancelLook();
    if (el.dataset.state === 'idle' && !bubbleTimer) say(L('hover', '点我一键解题'), 0, false);
    if (el.dataset.state === 'idle' && !el.dataset.mood) setMood('happy', 1400);
    clearWeb();
    startHover();
  }

  function onLeave() {
    if (!el) return;
    stopHover();
    endPet(true);
    if (el.dataset.state !== 'idle') return;
    if (!bubbleTimer) say('', 0, false);
    if (el.dataset.mood === 'happy') clearMood();
    armLook();
  }

  /* 鼠标在它身上划线：摸头判定 + 顺手把灰抖掉 */
  function onHoverMove(e) {
    if (!el || drag || e.buttons) return;
    if (el.dataset.state !== 'idle') return;
    if (webOn) clearWeb();
    if (el.dataset.mood && el.dataset.mood !== 'pet') return;
    feedPet(e.clientX, Date.now());
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
    // 闲着没事，偷看一眼头顶的计时牌（像在等下班）
    peekTimer = setTimeout(() => {
      peekTimer = null;
      if (!el || drag || el.dataset.state !== 'idle' || el.dataset.mood) return;
      setMood('peek', 900);
    }, 30000);
    // 快睡着之前先打个哈欠，别「啪」一下就睡过去
    yawnTimer = setTimeout(() => {
      yawnTimer = null;
      if (!el || drag || el.dataset.state !== 'idle' || el.dataset.mood) return;
      setMood('yawn', 1500);
    }, 42000);
    sleepTimer = setTimeout(() => {
      if (el && el.dataset.state === 'idle' && !el.dataset.mood) {
        setMood('sleepy', 0);
        // 睡了就别再惦记着到处蹦
        if (wanderTimer) { clearTimeout(wanderTimer); wanderTimer = null; }
      }
    }, 50000);
    // 醒着的时候：隔一会儿挪一小段，别等太久
    scheduleWander(7000 + Math.random() * 6000);
    scheduleWeb();
  }

  function stopIdle() {
    if (idleTimer) { clearInterval(idleTimer); idleTimer = null; }
    if (sleepTimer) { clearTimeout(sleepTimer); sleepTimer = null; }
    if (yawnTimer) { clearTimeout(yawnTimer); yawnTimer = null; }
    if (peekTimer) { clearTimeout(peekTimer); peekTimer = null; }
  }

  /* ---------- 表情 ---------- */
  /* 立刻摘掉（切到工作状态时用，别让旧表情的尾巴拖住动画） */
  function clearMoodNow() {
    if (tailTimer) { clearTimeout(tailTimer); tailTimer = null; }
    if (!el) return;
    delete el.dataset.mood;
    delete el.dataset.moodOut;
  }

  /* 带惯性地退场：先标记 data-mood-out 让 CSS 播收尾，时间到了再摘 */
  function clearMood() {
    if (!el) return;
    if (moodTimer) { clearTimeout(moodTimer); moodTimer = null; }
    const cur = el.dataset.mood;
    if (!cur) return;

    const tail = prefersReduced() ? 0 : (MOOD_TAIL[cur] || 0);
    if (!tail) { clearMoodNow(); return; }

    el.dataset.moodOut = '1';
    if (tailTimer) clearTimeout(tailTimer);
    tailTimer = setTimeout(() => {
      tailTimer = null;
      if (!el || !el.dataset.moodOut) return;
      delete el.dataset.mood;
      delete el.dataset.moodOut;
    }, tail);
  }

  /* ms = 0 表示一直保持，直到下次显式切换 */
  function setMood(name, ms) {
    if (!el || !name) return;
    if (moodTimer) { clearTimeout(moodTimer); moodTimer = null; }
    if (tailTimer) { clearTimeout(tailTimer); tailTimer = null; }
    delete el.dataset.moodOut;
    el.dataset.mood = name;
    if (ms) {
      moodTimer = setTimeout(() => {
        moodTimer = null;
        if (el && el.dataset.state === 'idle') clearMood();
      }, ms);
    }
  }

  /* ---------- 一次性小动作：都挂在已有事件上，不新增轮询 ---------- */
  let fxTimer = null;
  let lookTimer = null;

  /* name 对应 CSS 里的 [data-fx="..." ]，到点自己摘掉 */
  function playFx(name, ms) {
    if (!el || !name || prefersReduced()) return;
    if (fxTimer) clearTimeout(fxTimer);
    el.dataset.fx = name;
    fxTimer = setTimeout(() => {
      fxTimer = null;
      if (el && el.dataset.fx === name) delete el.dataset.fx;
    }, ms || 900);
  }

  /* 答完几题，头顶就弹个数字球 */
  function countTo(n) {
    if (!el) return;
    const box = el.querySelector('.qc-bot-count');
    if (box) box.textContent = String(n);
    playFx('count', 950);
  }

  /* 把答案「投递」出去：和数字球同时播，所以单独用一个属性 */
  let flyTimer = null;
  function flyOut() {
    if (!el || prefersReduced()) return;
    el.dataset.fly = '1';
    if (flyTimer) clearTimeout(flyTimer);
    flyTimer = setTimeout(() => {
      flyTimer = null;
      if (el) delete el.dataset.fly;
    }, 860);
  }

  /* 菜单弹出时探个头看它一眼（菜单在左边，不用挪位置） */
  function peekMenu(on) {
    if (!el) return;
    if (on) el.dataset.lookmenu = '1';
    else delete el.dataset.lookmenu;
  }

  /* 光标走开一会儿才「找人」，马上回来就不播 */
  function cancelLook() {
    if (lookTimer) {
      clearTimeout(lookTimer);
      lookTimer = null;
    }
  }

  function armLook() {
    cancelLook();
    if (prefersReduced()) return;
    lookTimer = setTimeout(() => {
      lookTimer = null;
      if (!el || drag || tracking || el.dataset.state !== 'idle' || el.dataset.mood) return;
      setMood('look', 1200);
    }, 1500);
  }

  /* 页面滚动：晃一下，1.5 秒内只晃一次 */
  let lastSwayAt = 0;
  function onScroll() {
    if (!el || drag || el.dataset.state !== 'idle' || prefersReduced()) return;
    const now = Date.now();
    if (now - lastSwayAt < 1500) return;
    lastSwayAt = now;
    playFx('sway', 520);
  }

  /* 切出去再回来：伸个懒腰；要是睡过去了，先醒 */
  function onVisible() {
    if (!el || document.visibilityState !== 'visible') return;
    if (el.dataset.state !== 'idle') return;
    if (el.dataset.mood === 'sleepy') {
      wake();
      return;
    }
    setMood('stretch', 1150);
  }

  /* ---------- 被戳烦了 ---------- */
  function poke() {
    const now = Date.now();
    pokeTimes = pokeTimes.filter((t) => now - t < 2600);
    pokeTimes.push(now);
    if (pokeTimes.length < 3) return;
    pokeTimes = [];
    setMood('angry', 1000);
    say(L('poke', '别戳啦，在算了'), 1400, false);
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
    btn.innerHTML = BOT_INNER;
    applyWear(btn);

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (suppressClick) return;
      if (el && el.dataset.busy === '1') return;   // 正在滚过去，别打断

      // 记一下点在哪：双击下半身 = 挠痒，其余还是「蹦一下」
      const tapBox = btn.getBoundingClientRect();
      lastTapY = e.clientY - tapBox.top;
      lastTapH = tapBox.height;

      // 刚被摸完头就被点一下：只当收手，别把「摸头」变成「解题」
      if (petting) { endPet(true); return; }

      stopHover();
      clearWeb();

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
    btn.addEventListener('pointermove', onHoverMove, { passive: true });
    btn.addEventListener('pointerup', onUp);
    btn.addEventListener('pointercancel', onUp);

    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      stopHover();
      if (Q.menu && Q.menu.open) Q.menu.open();
    });

    const bubble = btn.querySelector('.qc-bot-bubble');
    bubble.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (bubble.dataset.act !== '1') return;
      if (Q.bubbleAction) Q.bubbleAction();
      else {
        if (Q.openPanel) Q.openPanel();
        if (Q.render) Q.render();
      }
    });

    shadow.appendChild(btn);
    el = btn;

    try {
      window.addEventListener('resize', onResize, { passive: true });
      window.addEventListener('pointermove', onWindowMove, { passive: true });
      // 滚动事件不冒泡，用 capture 才收得到页面里那些滚动容器
      window.addEventListener('scroll', onScroll, { passive: true, capture: true });
      document.addEventListener('visibilitychange', onVisible);
    } catch (e) {}

    restorePos();
    restoreSkin();
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

    // 开始干活：摸头、好奇、落灰这些小动作全部收起来
    stopIdle();
    endPet(true);
    stopHover();
    webOn = false;
    if (webTimer) { clearTimeout(webTimer); webTimer = null; }
    delete el.dataset.web;
    if (state === 'error') setMood('sad', 0);
    else clearMoodNow();
  }

  /* 气泡挂哪边：默认在机器人左侧，贴左缘就翻到右边；贴近顶部则挂到下方 */
  function placeBubble() {
    if (!el) return;
    const r = el.getBoundingClientRect();
    // 移动/吸附有过渡动画，rect 拿到的是中间值，优先用 style 上的目标坐标
    const left = el.style.left ? parseFloat(el.style.left) : r.left;
    const top = el.style.top ? parseFloat(el.style.top) : r.top;
    if (!isNaN(left) && left < 260) el.dataset.bubble = 'right';
    else delete el.dataset.bubble;
    if (!isNaN(top) && top < 80) el.dataset.v = 'down';
    else delete el.dataset.v;
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
    const t = b.querySelector('.qc-bot-bubble-txt') || b;
    t.textContent = text || '';
    b.title = text ? String(text) : '';
    if (text) placeBubble();
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
    clearMoodNow();
    stopFollow();
    stopHover();
    if (hopTimer) { clearTimeout(hopTimer); hopTimer = null; }
    if (wanderTimer) { clearTimeout(wanderTimer); wanderTimer = null; }
    if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
    if (doubleTimer) { clearTimeout(doubleTimer); doubleTimer = null; }
    if (dizzySettle) { clearTimeout(dizzySettle); dizzySettle = null; }
    if (dizzyFallback) { clearTimeout(dizzyFallback); dizzyFallback = null; }
    if (settleTimer) { clearTimeout(settleTimer); settleTimer = null; }
    if (webTimer) { clearTimeout(webTimer); webTimer = null; }
    if (petEndTimer) { clearTimeout(petEndTimer); petEndTimer = null; }
    tapCount = 0;
    doublePlayed = false;
    lastTapAt = 0;
    petting = false;
    petSamples = [];
    sweepSamples = [];
    webOn = false;
    if (fxTimer) { clearTimeout(fxTimer); fxTimer = null; }
    if (flyTimer) { clearTimeout(flyTimer); flyTimer = null; }
    cancelLook();
    if (rafId && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafId);
    rafId = 0;
    dragSamples = [];
    try {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onWindowMove);
      window.removeEventListener('scroll', onScroll, { capture: true });
      document.removeEventListener('visibilitychange', onVisible);
    } catch (e) {}
    drag = null;
    if (el && el.isConnected) el.remove();
    el = null;
  }

  const SKINS = ['blue', 'mint', 'peach', 'ink'];

  function setSkin(name) {
    if (!el) return;
    const s = SKINS.indexOf(name) >= 0 ? name : 'blue';
    if (s === 'blue') delete el.dataset.skin;
    else el.dataset.skin = s;
  }

  function nextSkin() {
    if (!el) return 'blue';
    const cur = el.dataset.skin || 'blue';
    const i = SKINS.indexOf(cur);
    return SKINS[(i + 1) % SKINS.length];
  }

  /* ---------- 换装 ---------- */
  function normWear(w) {
    const out = {};
    WEAR_KINDS.forEach((k) => {
      const v = w && w[k];
      out[k] = WEAR_ITEMS[k].indexOf(v) >= 0 ? v : 'none';
    });
    return out;
  }

  /* 三个 data-* 一律写满（包括 none）。CSS 靠 :not([data-hat="none"]) 判断有没有戴帽子，
     属性缺省和 "none" 在 :not() 里行为不同，必须补够 */
  function applyWear(node) {
    const t = node || el;
    if (!t) return;
    const w = normWear(Q.S && Q.S.botWear);
    t.dataset.hat = w.hat;
    t.dataset.ears = w.ears;
    t.dataset.neck = w.neck;
  }

  function setWear(w, opts) {
    const before = getWear();
    Q.S.botWear = normWear(w);
    applyWear();
    // 换帽子才播「扶帽」，只换耳朵就抖个耳朵
    if (before.hat !== Q.S.botWear.hat) playFx('wear', 760);
    else if (before.ears !== Q.S.botWear.ears) playFx('earflick', 520);
    if (!opts || opts.save !== false) {
      try { chrome.storage.sync.set({ botWear: Q.S.botWear }); } catch (e) {}
    }
    return Q.S.botWear;
  }

  function getWear() {
    return normWear(Q.S && Q.S.botWear);
  }

  function randomWear() {
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    return {
      hat: pick(WEAR_ITEMS.hat.slice(1)),
      ears: pick(WEAR_ITEMS.ears),
      neck: pick(WEAR_ITEMS.neck)
    };
  }

  Q.mascot = { mount, getState, setState, setMood, say, settleAfter, show, destroy, moveTo, hop, rollTo, rollHome, growWeb, clearWeb, armWeb: scheduleWeb, setWebRetry: (ms) => { webRetry = Math.max(20, Number(ms) || WEB_RETRY); }, webAfter: () => WEB_AFTER, wanderOnce: wander, setSkin, nextSkin, setWear, getWear, randomWear, WEAR_ITEMS, WEAR_CN, BOT_INNER, getEl: () => el, CSS, SKINS, playFx, countTo, flyOut, peekMenu, travelTo, pickTravel, TRAVELS };
})();
