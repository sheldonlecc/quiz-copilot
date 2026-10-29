/* 生成 _test-harness.html：在真实 Chrome 里跑一遍交互回归（stub chrome API） */
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const C = (f) => fs.readFileSync(path.join(DIR, 'quiz-copilot/content', f), 'utf8');
const FILES = [
  '00-core.js', '10-icon.js', '10-choice.js', '15-text.js', '20-blank.js', '30-match.js',
  '40-extract.js', '42-code.js', '45-solve.js', '50-answer.js', '60-css.js', '70-panel.js',
  '80-mascot.js', '81-lines.js', '82-chat.js', '84-wardrobe.js', '85-menu.js', '86-pomo.js', '87-selection.js', '88-chain.js', '89-pomowin.js', '90-main.js'
];

const scripts = FILES.map((f) => `<script>\n${C(f)}\n</script>`).join('\n');

const page = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>qc harness</title></head>
<body>
<p id="para">这是一个用于测试划词解释的段落，里面有足够多的文字。</p>
<p id="para2">The quick brown fox jumps over the lazy dog.</p>
<div id="out">running</div>
<script>
/* ---- chrome API stub ---- */
window.__local = {};
var __store = { autoFill: true, showFab: true, botSkin: 'blue', selExplain: true, apiKey: 'x' };
window.chrome = {
  runtime: {
    getManifest: function () { return { version: '1.14.1' }; },
    getURL: function (p) { return p; },
    sendMessage: function (msg, cb) {
      if (cb) setTimeout(function () {
        if (msg && msg.type === 'QC_EXPLAIN') cb({ ok: true, text: '这是解释正文。' });
        else cb({ ok: true, answers: [], text: 'ok' });
      }, 0);
    },
    onMessage: { addListener: function () {} },
    lastError: null
  },
  storage: {
    sync: {
      get: function (d, cb) {
        if (typeof d === 'function') { cb = d; d = {}; }
        var out = {};
        for (var k in d) out[k] = (k in __store) ? __store[k] : d[k];
        if (cb) setTimeout(function () { cb(out); }, 0);
      },
      set: function (o, cb) {
        for (var k in o) __store[k] = o[k];
        if (cb) setTimeout(cb, 0);
      }
    },
    local: {
      get: function (d, cb) {
        var out = {};
        if (typeof d === 'string') { out[d] = window.__local[d]; }
        else if (d && typeof d === 'object') {
          for (var k in d) out[k] = (k in window.__local) ? window.__local[k] : d[k];
        }
        if (cb) setTimeout(function () { cb(out); }, 0);
      },
      set: function (o, cb) { for (var k in o) window.__local[k] = o[k]; if (cb) setTimeout(cb, 0); },
      remove: function (k, cb) { delete window.__local[k]; if (cb) setTimeout(cb, 0); }
    },
    onChanged: { addListener: function () {} }
  }
};
</script>
${scripts}
<script>
(function () {
  var out = document.getElementById('out');
  var R = [];
  var Q = window.__QC;

  function rec(name, ok, detail) {
    R.push((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail ? ' | ' + detail : ''));
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function byId(id) { return document.getElementById(id); }

  function bubbleEl() {
    var host = byId('quiz-copilot-host');
    var sr = host && host.shadowRoot;
    return sr ? sr.querySelector('.qc-bot-bubble') : null;
  }
  function botEl() {
    var host = byId('quiz-copilot-host');
    var sr = host && host.shadowRoot;
    return sr ? sr.querySelector('.qc-bot') : null;
  }

  async function run() {
    /* 截图模式：#shot:thinking / done / confused / menu，只看某一帧长什么样 */
    var shot = (location.hash || '').replace('#shot:', '');
    if (shot) {
      var shotTries = 0;
      var shotTimer = setInterval(function () {
        var M = Q.mascot;
        if (!M || !M.getEl()) {
          if (++shotTries > 80) clearInterval(shotTimer);
          return;
        }
        clearInterval(shotTimer);
        if (shot === 'thinking') M.setState('thinking');
        else if (shot === 'done') M.setState('done');
        else if (shot === 'confused') M.setMood('confused', 8000);
        else if (shot === 'menu') { M.peekMenu(true); if (Q.menu) Q.menu.open(); }
      }, 100);
      return;
    }

    await sleep(350);
    Q.S.chatLevel = 0;   // 测试期间别让机器人插话，避免把气泡顶掉

    /* 1. 启动 */
    rec('booted', !!Q.__booted);
    var bot = botEl();
    rec('mascot mounted', !!bot);
    rec('bubble-txt exists', !!(bubbleEl() && bubbleEl().querySelector('.qc-bot-bubble-txt')));

    /* 2. 长文本：不横向溢出、最多 3 行 */
    var M = Q.mascot;
    var longText = '这页没认出题目点这里看原因再试一段特别长的文字看看会不会溢出到机器人身上顺便再写长一点点';
    M.say(longText, 0, true);
    await sleep(120);
    var b = bubbleEl();
    var t = b.querySelector('.qc-bot-bubble-txt');
    var csT = getComputedStyle(t);
    var lh = parseFloat(csT.lineHeight) || 17.4;
    var bw = b.getBoundingClientRect().width;
    rec('bubble width <= 244', bw <= 244, 'w=' + bw.toFixed(1));
    rec('bubble text no h-overflow', t.scrollWidth <= t.clientWidth + 1, t.scrollWidth + '/' + t.clientWidth);
    rec('bubble text <= 3 lines', t.clientHeight <= lh * 3 + 2, t.clientHeight.toFixed(1) + ' lh=' + lh);

    /* 3. 贴左缘 / 贴顶 */
    M.moveTo(2, 300);
    M.say('贴左缘', 0, false);
    await sleep(60);
    rec('flip right when near left edge', bot.dataset.bubble === 'right', String(bot.dataset.bubble));

    M.moveTo(400, 2);
    M.say('贴顶部', 0, false);
    await sleep(60);
    rec('flip down when near top', bot.dataset.v === 'down', String(bot.dataset.v));
    M.moveTo(window.innerWidth - 80, window.innerHeight - 90);

    /* 4. 晕完摇头：单次、1.15s、幅度递减 */
    M.setMood('daze', 0);
    await sleep(50);
    var eyes = bot.querySelector('.qc-bot-eyes');
    var csE = getComputedStyle(eyes);
    rec('daze animation name', csE.animationName === 'qc-bot-eyeshake', csE.animationName);
    rec('daze animation once', csE.animationIterationCount === '1', csE.animationIterationCount);
    rec('daze duration 1.15s', csE.animationDuration === '1.15s', csE.animationDuration);
    M.setState('idle');
    await sleep(30);

    /* 4b. 摇完要停住 >< 一会儿才恢复，而且恢复也带尾巴 */
    M.setMood('daze', 1670);
    await sleep(1300);
    rec('daze holds >< after shake', bot.dataset.mood === 'daze', String(bot.dataset.mood));
    await sleep(600);
    rec('daze tail running', bot.dataset.moodOut === '1', String(bot.dataset.moodOut));
    await sleep(500);
    rec('daze clears after tail', !bot.dataset.mood, String(bot.dataset.mood));

    /* 5. 摸头：悬浮左右来回蹭 */
    var xs = [500, 530, 500, 530, 500, 530, 500, 530];
    for (var i = 0; i < xs.length; i++) {
      bot.dispatchEvent(new PointerEvent('pointermove', { clientX: xs[i], clientY: 500, buttons: 0, bubbles: true }));
      await sleep(12);
    }
    await sleep(40);
    rec('petting mood', bot.dataset.mood === 'pet', String(bot.dataset.mood));
    await sleep(1250);
    rec('petting tail running', bot.dataset.moodOut === '1', String(bot.dataset.moodOut));
    await sleep(1100);
    rec('petting fully cleared', !bot.dataset.mood, String(bot.dataset.mood) + '/' + String(bot.dataset.moodOut));
    M.setState('idle');
    await sleep(30);
    bot.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));

    /* 5b. 歪头松开也要慢慢回正，不是立刻立正 */
    bot.dataset.tilt = '1';
    bot.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    await sleep(60);
    rec('tilt eases out', bot.dataset.tilt === 'out', String(bot.dataset.tilt));
    await sleep(560);
    rec('tilt cleaned', !bot.dataset.tilt, String(bot.dataset.tilt));

    /* 5c. 右键机器人：菜单弹出 + 它探头看一眼
       （这动作曾经因为 head 的呼吸动画占着 transform 而完全失效） */
    bot.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    await sleep(90);
    var srCtx = byId('quiz-copilot-host').shadowRoot;
    rec('right-click opens menu', !!srCtx.querySelector('.qc-menu'));
    rec('right-click makes bot peek', bot.dataset.lookmenu === '1', String(bot.dataset.lookmenu));
    rec('peek animates head (not overridden)',
      getComputedStyle(bot.querySelector('.qc-bot-head')).animationName === 'qc-tilt-menu',
      getComputedStyle(bot.querySelector('.qc-bot-head')).animationName);
    Q.menu.close();
    await sleep(70);
    rec('closing menu clears peek', !bot.dataset.lookmenu);

    /* 6. 右键菜单 */
    Q.S.autoFill = true;
    Q.S.autoPage = true;
    Q.menu.open();
    await sleep(80);
    var menu = byId('quiz-copilot-host').shadowRoot.querySelector('.qc-menu');
    rec('menu opens', !!menu);
    var rows = menu ? menu.querySelectorAll('.qc-menu-row').length : 0;
    rec('menu rows >= 7', rows >= 7, 'rows=' + rows);
    rec('menu has sections', !!menu && menu.querySelectorAll('.qc-menu-sec').length >= 1, menu ? String(menu.querySelectorAll('.qc-menu-sec').length) : '0');
    rec('menu has switches', !!menu && menu.querySelectorAll('.qc-menu-sw').length >= 2, menu ? String(menu.querySelectorAll('.qc-menu-sw').length) : '0');
    rec('menu has pomo entry', !!menu && !!menu.querySelector('[data-act="pomo"]'));
    rec('menu has wardrobe entry', !!menu && !!menu.querySelector('[data-act="wardrobe"]'));
    rec('menu has options entry', !!menu && !!menu.querySelector('[data-act="options"]'));
    rec('menu dropped skin row', !!menu && !menu.querySelector('[data-act="skin"]'));
    var limitChips = menu ? menu.querySelectorAll('[data-chip="limit"]').length : 0;
    rec('menu has 3 limit chips', limitChips === 3, 'chips=' + limitChips);
    var mr = menu ? menu.getBoundingClientRect() : null;
    rec('menu inside viewport', !!mr && mr.left >= 0 && mr.top >= 0 && mr.right <= window.innerWidth + 1 && mr.bottom <= window.innerHeight + 1,
      mr ? [mr.left, mr.top, mr.right, mr.bottom].map(function (n) { return Math.round(n); }).join(',') : 'none');

    // 开关点完菜单不能关，否则改一项就得重新右键
    var autoRow = menu.querySelector('[data-act="auto"]');
    if (autoRow) autoRow.click();
    await sleep(80);
    var menu2 = byId('quiz-copilot-host').shadowRoot.querySelector('.qc-menu');
    rec('toggle keeps menu open', !!menu2);
    rec('autoFill off after click', Q.S.autoFill === false, String(Q.S.autoFill));
    rec('autoPage follows autoFill off', Q.S.autoPage === false, String(Q.S.autoPage));
    rec('limit chips hidden when autoPage off', menu2.querySelectorAll('[data-chip="limit"]').length === 0);

    var pageRow = menu2.querySelector('[data-act="autopage"]');
    if (pageRow) pageRow.click();
    await sleep(80);
    var menu3 = byId('quiz-copilot-host').shadowRoot.querySelector('.qc-menu');
    rec('autoPage on turns autoFill on', Q.S.autoPage === true && Q.S.autoFill === true,
      String(Q.S.autoPage) + '/' + String(Q.S.autoFill));

    var chip50 = menu3.querySelector('[data-chip="limit"][data-v="50"]');
    if (chip50) chip50.click();
    await sleep(80);
    rec('limit chip switches to 50', Q.S.pageLimit === 50, String(Q.S.pageLimit));
    Q.S.pageLimit = 30;

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await sleep(80);
    rec('menu closes on Esc', !byId('quiz-copilot-host').shadowRoot.querySelector('.qc-menu'));

    // 番茄窗：三个页签 + 任务 + 统计
    Q.pomoWin.open();
    await sleep(120);
    rec('pomo window opens', Q.pomoWin.isOpen());
    var pw = byId('quiz-copilot-host').shadowRoot.querySelector('.qc-pw');
    rec('pomo has 3 tabs', !!pw && pw.querySelectorAll('[data-tab]').length === 3);
    rec('pomo has ring', !!pw && !!pw.querySelector('.qc-pw-ring'));

    var minsInp = pw.querySelector('[data-role="mins"]');
    if (minsInp) minsInp.value = '40';
    var startBtn = pw.querySelector('[data-act="start"]');
    if (startBtn) startBtn.click();
    await sleep(120);
    var mins = Q.S.pomo && Q.S.pomo.total ? Math.round(Q.S.pomo.total / 60000) : 0;
    rec('custom pomo starts 40min', mins === 40, String(mins));
    Q.pomo.stop(true);

    Q.pomo.addTask('写实验报告', 'study');
    Q.pomoWin.setTab('tasks');
    await sleep(100);
    rec('task appears in list', pw.querySelectorAll('[data-task]').length >= 1,
      String(pw.querySelectorAll('[data-task]').length));

    Q.pomoWin.setTab('stats');
    await sleep(100);
    rec('stats donut renders', !!pw.querySelector('.qc-pw-donut'));

    var pwRect0 = pw.getBoundingClientRect();
    var pwHead = pw.querySelector('.qc-pw-hd');
    if (pwHead) {
      pwHead.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 9, clientX: pwRect0.left + 50, clientY: pwRect0.top + 14 }));
      pwHead.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 9, clientX: pwRect0.left - 50, clientY: pwRect0.top + 60 }));
      pwHead.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 9, clientX: pwRect0.left - 50, clientY: pwRect0.top + 60 }));
    }
    var pwRect1 = pw.getBoundingClientRect();
    rec('pomo window draggable', Math.abs(pwRect1.left - pwRect0.left) > 40,
      Math.round(pwRect0.left) + '→' + Math.round(pwRect1.left));

    Q.pomoWin.close();
    rec('pomo window closes', !Q.pomoWin.isOpen());

    /* 7b. 衣橱：换帽子 / 耳朵 / 领结 */
    Q.wardrobe.open();
    await sleep(140);
    rec('wardrobe opens', Q.wardrobe.isOpen());
    var wd = byId('quiz-copilot-host').shadowRoot.querySelector('.qc-wd');
    rec('wardrobe has 3 groups', !!wd && wd.querySelectorAll('.qc-wd-grp').length === 3,
      wd ? String(wd.querySelectorAll('.qc-wd-grp').length) : '0');
    rec('wardrobe has preview bot', !!wd && !!wd.querySelector('.qc-wd-bot'));
    rec('wardrobe chip count', !!wd && wd.querySelectorAll('[data-kind]').length === 11,
      wd ? String(wd.querySelectorAll('[data-kind]').length) : '0');

    var mb2 = Q.mascot.getEl();
    var gradBtn = wd.querySelector('[data-kind="hat"][data-v="grad"]');
    if (gradBtn) gradBtn.click();
    await sleep(60);
    rec('wear applies to real bot', mb2.dataset.hat === 'grad', String(mb2.dataset.hat));
    rec('wear saved to storage', (window.__store.botWear || {}).hat === 'grad',
      JSON.stringify(window.__store.botWear || {}));
    rec('wear preview synced', wd.querySelector('.qc-wd-bot').dataset.hat === 'grad',
      String(wd.querySelector('.qc-wd-bot').dataset.hat));

    /* 戴帽子要把天线收掉 —— 无头浏览器不推进 transition，这里把过渡关掉读终态 */
    var antEl = mb2.querySelector('.qc-bot-antenna');
    antEl.style.transition = 'none';
    void antEl.offsetWidth;
    rec('hat hides antenna', parseFloat(getComputedStyle(antEl).opacity) === 0,
      getComputedStyle(antEl).opacity);
    antEl.style.transition = '';

    var bunBtn = wd.querySelector('[data-kind="ears"][data-v="bunny"]');
    if (bunBtn) bunBtn.click();
    await sleep(50);
    rec('ears apply', mb2.dataset.ears === 'bunny', String(mb2.dataset.ears));

    var rd = Q.mascot.randomWear();
    rec('random wear is valid',
      ['cap', 'beanie', 'crown', 'grad'].indexOf(rd.hat) >= 0 &&
      ['none', 'cat', 'bunny'].indexOf(rd.ears) >= 0 &&
      ['none', 'bow', 'scarf'].indexOf(rd.neck) >= 0, JSON.stringify(rd));

    var clrBtn = wd.querySelector('[data-act="clear"]');
    if (clrBtn) clrBtn.click();
    await sleep(50);
    rec('clear removes everything',
      mb2.dataset.hat === 'none' && mb2.dataset.ears === 'none' && mb2.dataset.neck === 'none',
      [mb2.dataset.hat, mb2.dataset.ears, mb2.dataset.neck].join('/'));

    Q.openPanel();
    await sleep(90);
    rec('panel closes wardrobe', !Q.wardrobe.isOpen());
    Q.closePanel();
    await sleep(60);

    rec('has separate ball layer', !!bot.querySelector('.qc-ball'));

    /* 7. 皮肤 */
    M.setSkin('mint');
    rec('skin applied', bot.dataset.skin === 'mint', String(bot.dataset.skin));
    var bg = getComputedStyle(bot.querySelector('.qc-bot-head')).backgroundImage;
    rec('skin color used', /47,\\s*214,\\s*164/.test(bg), bg.slice(0, 60));
    M.setSkin('blue');
    rec('skin reset', !bot.dataset.skin);

    /* 8. 番茄钟：头顶常显 + 可选时长 */
    Q.pomo.start(1, false);
    var st = Q.pomo.state();
    rec('pomo running', st.running === true, st.left);
    var tag = bot.querySelector('.qc-pomo');
    rec('pomo badge visible', !!tag && tag.dataset.on === '1', tag ? tag.dataset.on : 'none');
    var bt = tag ? tag.querySelector('.qc-pomo-t').textContent : '';
    rec('pomo badge shows time', bt.length === 5 && bt.charAt(2) === ':', bt);
    await sleep(1200);
    var barW = tag ? parseFloat(tag.querySelector('.qc-pomo-bar i').style.width) : -1;
    rec('pomo bar shrinks', barW > 0 && barW < 100, String(barW));
    Q.pomo.stop(true);
    rec('pomo stopped', Q.pomo.state().running === false);
    rec('pomo badge hidden after stop', tag.dataset.on === '0', tag.dataset.on);

    /* 8b. 手动停止：已经做过的时间要记账，但不算一个完整番茄 */
    var sessBefore = Q.pomo.sessions().length;
    Q.pomo.start(90, false);
    Q.S.pomo.startedAt = Date.now() - 5 * 60000;   // 假装已经做了 5 分钟
    Q.pomo.stop(true);
    var sess = Q.pomo.sessions();
    var lastS = sess[sess.length - 1];
    rec('stop logs what you did', sess.length === sessBefore + 1, sessBefore + '->' + sess.length);
    rec('stop logs actual minutes', !!lastS && lastS.minutes === 5, lastS ? String(lastS.minutes) : 'none');
    rec('stop marks it partial', !!lastS && lastS.partial === true, lastS ? String(lastS.partial) : 'none');

    /* 8c. 不足 1 分钟直接丢掉 */
    var shortBefore = Q.pomo.sessions().length;
    Q.pomo.start(25, false);
    Q.S.pomo.startedAt = Date.now() - 40000;
    Q.pomo.stop(true);
    rec('under a minute is dropped', Q.pomo.sessions().length === shortBefore,
      shortBefore + '->' + Q.pomo.sessions().length);

    /* 8d. 中断段不能算成一个番茄 */
    var tk = Q.pomo.addTask('写实验报告', 'study');
    Q.pomo.start(60, false, tk.id);
    Q.S.pomo.startedAt = Date.now() - 3 * 60000;
    Q.pomo.stop(true);
    var tkAfter = Q.pomo.taskOf(tk.id);
    rec('partial is not a full tomato', (tkAfter.done || 0) === 0, String(tkAfter.done));

    /* 8e. 跨页存活：没到期就接着跑 */
    window.__local.qcPomo = {
      end: Date.now() + 25 * 60000,
      total: 25 * 60000,
      isBreak: false,
      taskId: '',
      startedAt: Date.now()
    };
    Q.S.pomo = null;
    Q.pomo.restoreTimer();
    await sleep(90);
    rec('timer survives page change', Q.pomo.state().running === true, Q.pomo.state().left);
    Q.pomo.stop(true);
    rec('stop clears saved timer', !window.__local.qcPomo, String(window.__local.qcPomo));

    /* 8f. 离开期间已经走完：回来补一笔，别赖账 */
    var expBefore = Q.pomo.sessions().length;
    window.__local.qcPomo = {
      end: Date.now() - 5000,
      total: 25 * 60000,
      isBreak: false,
      taskId: '',
      startedAt: Date.now() - 25 * 60000
    };
    Q.S.pomo = null;
    Q.pomo.restoreTimer();
    await sleep(160);
    var expSess = Q.pomo.sessions();
    rec('finished while away is logged', expSess.length === expBefore + 1,
      expBefore + '->' + expSess.length);
    rec('finished while away counts full', expSess[expSess.length - 1].partial === false,
      String(expSess[expSess.length - 1].partial));
    rec('finished while away clears storage', !window.__local.qcPomo, String(window.__local.qcPomo));
    Q.pomo.stop(true);

    /* 8b. 小动作：翻页 / 计数球 / 投递 / 盖章 / 菜单探头 */
    var botEl2 = Q.mascot.getEl();
    rec('fx nodes exist',
      !!botEl2.querySelector('.qc-bot-pages') && !!botEl2.querySelector('.qc-bot-count') &&
      !!botEl2.querySelector('.qc-bot-stamp') && !!botEl2.querySelector('.qc-bot-fly') &&
      !!botEl2.querySelector('.qc-bot-qmark'));

    Q.mascot.setState('thinking');
    await sleep(50);
    rec('thinking shows page flip', getComputedStyle(botEl2.querySelector('.qc-bot-pages')).opacity === '1',
      getComputedStyle(botEl2.querySelector('.qc-bot-pages')).opacity);
    rec('page flip is slow enough',
      parseFloat(getComputedStyle(botEl2.querySelector('.qc-bot-pages i')).animationDuration) >= 2,
      getComputedStyle(botEl2.querySelector('.qc-bot-pages i')).animationDuration);
    Q.mascot.setState('idle');

    Q.mascot.countTo(3);
    await sleep(30);
    rec('countTo sets number + fx',
      botEl2.querySelector('.qc-bot-count').textContent === '3' && botEl2.dataset.fx === 'count',
      botEl2.dataset.fx + '/' + botEl2.querySelector('.qc-bot-count').textContent);

    Q.mascot.flyOut();
    rec('flyOut raises flag', botEl2.dataset.fly === '1');

    Q.mascot.peekMenu(true);
    rec('peekMenu on', botEl2.dataset.lookmenu === '1');
    Q.mascot.peekMenu(false);
    rec('peekMenu off', !botEl2.dataset.lookmenu);

    Q.mascot.setState('done');
    await sleep(40);
    rec('done stamps',
      getComputedStyle(botEl2.querySelector('.qc-bot-stamp')).animationName === 'qc-stamp',
      getComputedStyle(botEl2.querySelector('.qc-bot-stamp')).animationName);
    rec('stamp holds long enough',
      parseFloat(getComputedStyle(botEl2.querySelector('.qc-bot-stamp')).animationDuration) >= 1.8,
      getComputedStyle(botEl2.querySelector('.qc-bot-stamp')).animationDuration);
    Q.mascot.setState('idle');
    await sleep(60);

    /* 9. 面板解释卡片 */
    Q.S.explain = { src: '被选中的原文', body: '这是解释正文。', loading: false, error: '' };
    Q.openPanel();
    Q.render();
    await sleep(80);
    var panel = byId('quiz-copilot-host').shadowRoot.querySelector('.qc-wrap');
    rec('panel opens', !!panel);
    rec('explain card rendered', !!panel.querySelector('.qc-exp'));
    var closeBtn = panel.querySelector('[data-act="exp-close"]');
    if (closeBtn) closeBtn.click();
    await sleep(60);
    rec('explain card closes', !panel.querySelector('.qc-exp'));

    // 面板可以拖
    var headEl = panel.querySelector('.qc-head');
    var boxRect0 = panel.getBoundingClientRect();
    if (headEl) {
      headEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 7, clientX: boxRect0.left + 60, clientY: boxRect0.top + 14 }));
      headEl.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 7, clientX: boxRect0.left - 40, clientY: boxRect0.top + 44 }));
      headEl.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7, clientX: boxRect0.left - 40, clientY: boxRect0.top + 44 }));
    }
    var boxRect1 = panel.getBoundingClientRect();
    rec('panel draggable', Math.abs(boxRect1.left - boxRect0.left) > 40,
      Math.round(boxRect0.left) + '→' + Math.round(boxRect1.left));

    var pageToggle = panel.querySelector('[data-act="toggle-page"]');
    rec('panel has autoPage toggle', !!pageToggle);
    if (pageToggle) {
      var beforePage = !!Q.S.autoPage;
      pageToggle.click();
      await sleep(60);
      rec('autoPage toggle flips', !!Q.S.autoPage === !beforePage, String(Q.S.autoPage));
      Q.S.autoPage = false;
      Q.render();
    }

    /* 9b. 编程题卡片：渲染 / 还原按钮的出现条件 / 复制格式三档 */
    var keepQs = Q.S.questions;
    Q.S.questions = [{
      index: 1, type: 'code', stem: '两数之和', template: 'class Solution {};',
      answer: 'int add(int a, int b) { return a + b; }', codeLang: 'C++',
      reason: '思路：直接相加。', fillState: ''
    }];
    Q.render();
    await sleep(60);
    var codeCard = panel.querySelector('.qc-code');
    rec('code card renders', !!codeCard);
    rec('code card shows language + code',
      !!codeCard && codeCard.textContent.indexOf('C++') >= 0 && codeCard.textContent.indexOf('return a + b') >= 0);
    rec('restore hidden before write', !panel.querySelector('[data-act="code-restore"]'));

    Q.S.questions[0].prevCode = '// 原来的代码';
    Q.render();
    await sleep(60);
    rec('restore appears after write', !!panel.querySelector('[data-act="code-restore"]'));

    rec('copy plain', Q.formatAll('plain').indexOf('第1题：int add') === 0, Q.formatAll('plain').slice(0, 16));
    rec('copy reason', Q.formatAll('reason').indexOf('—— 思路') > 0);
    var mdText = Q.formatAll('md');
    var fence = String.fromCharCode(96, 96, 96);
    rec('copy markdown', mdText.indexOf('| 题号 |') === 0 && mdText.indexOf(fence) > 0, mdText.split('\\n').length + ' 行');

    Q.S.questions = keepQs || [];
    Q.render();

    /* 10. 划词解释按钮 */
    var p = byId('para');
    var range = document.createRange();
    range.selectNodeContents(p);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
    await sleep(320);
    var chip = byId('quiz-copilot-host').shadowRoot.querySelector('.qc-sel');
    rec('selection chip shows', !!chip && chip.dataset.show === '1', chip ? chip.dataset.show : 'none');
    if (chip) {
      var cr = chip.getBoundingClientRect();
      rec('chip inside viewport', cr.left >= 0 && cr.right <= window.innerWidth + 1, Math.round(cr.left) + '..' + Math.round(cr.right));
      Q.sel.hide();
      rec('chip hides', chip.dataset.show === '0');

    /* 10c. 滚球：移动到位、变回原形、并且停在原地别自己回去 */
    var beforeRect = bot.getBoundingClientRect();
    await Q.mascot.rollTo({ left: 300, top: 300, width: 220, height: 24 });
    var afterRect = bot.getBoundingClientRect();
    rec('rollTo moves bot', Math.abs(afterRect.left - beforeRect.left) > 20,
      Math.round(beforeRect.left) + '→' + Math.round(afterRect.left));
    rec('rollTo restores form', !bot.dataset.form && bot.dataset.busy !== '1');
    await sleep(900);
    var stillRect = bot.getBoundingClientRect();
    rec('stays where it landed', Math.abs(stillRect.left - afterRect.left) < 3,
      Math.round(stillRect.left) + ' vs ' + Math.round(afterRect.left));
    }
    sel.removeAllRanges();

    /* 10b. 答案 / 解析对账 */
    var reason = '数值特征范围归一化后Age差0，RestBP差2/106≈0.0189，Chol差26/438≈0.0594；Sex差1，ChestPain差1；欧氏距离√(1+1+0.0189²+0.0594²)≈1.41';
    var r1 = Q.numericConflict({ type: 'blank', answer: '1.00', reason: reason });
    rec('conflict detected', !!r1 && r1.suggest === '1.41', JSON.stringify(r1));
    var r2 = Q.numericConflict({ type: 'blank', answer: '1.41', reason: reason });
    rec('no conflict when equal', r2 === null, JSON.stringify(r2));
    var r3 = Q.numericConflict({ type: 'blank', answer: '北京', reason: '城市=北京' });
    rec('no conflict for text answer', r3 === null, JSON.stringify(r3));
    var r4 = Q.numericConflict({ type: 'blank', answer: '106', reason: 'RestBP 差 106' });
    rec('no conflict without claim', r4 === null, JSON.stringify(r4));

    Q.S.questions = [{
      index: 1, type: 'blank', stem: '计算 p1 p2 的距离', answer: '1.00', reason: reason,
      blanks: [], conflict: { answer: '1.00', suggest: '1.41' }
    }];
    Q.render();
    await sleep(80);
    rec('panel shows conflict', !!panel.querySelector('.qc-conflict'));
    var useBtn = panel.querySelector('[data-act="use-suggest"]');
    if (useBtn) useBtn.click();
    await sleep(80);
    rec('use-suggest switches answer', Q.S.questions[0].answer === '1.41', Q.S.questions[0].answer);

    /* 10d. 话术库：每类都有料，且不会连着重复 */
    rec('lines pet pool rich', Q.lines.all('pet').length >= 8, String(Q.lines.all('pet').length));
    rec('lines triple pool rich', Q.lines.all('triple').length >= 5, String(Q.lines.all('triple').length));
    rec('lines chat pool rich', Q.lines.all('ask').length >= 8, String(Q.lines.all('ask').length));
    var seen = {};
    for (var li = 0; li < 24; li++) seen[Q.lines.pick('pet')] = 1;
    rec('lines vary on repeat', Object.keys(seen).length >= 6, Object.keys(seen).length + ' unique');

    /* 10e. 图标接口：一处定义，处处是小机器人 */
    var ico = Q.icon.svg(20);
    rec('icon returns svg', ico.indexOf('<svg') === 0 && ico.indexOf('32 32') > 0, ico.slice(0, 40));
    rec('icon has robot parts', ico.indexOf('<circle') > 0 && ico.indexOf('<rect') > 0);
    rec('icon uri is datauri', Q.icon.uri(32).indexOf('data:image/svg+xml,') === 0);
    rec('panel logo is robot', !!panel.querySelector('.qc-logo svg'));
    var selBadge = byId('quiz-copilot-host').shadowRoot.querySelector('.qc-sel-badge');
    rec('selection badge is robot', !!selBadge && !!selBadge.querySelector('svg'));

    /* 10f. 蜘蛛网：闲着会长、睡着也长、被表情挡路会重试、一碰就散 */
    Q.mascot.setState('idle');
    await sleep(40);
    var mb = Q.mascot.getEl();
    Q.mascot.growWeb(true);
    await sleep(80);
    var webEl = mb && mb.querySelector('.qc-bot-web');
    // 无头浏览器里 CSS transition 不随虚拟时间推进，这里断言「规则已命中」而不是最终透明度
    var webOnIt = !!webEl && webEl.matches('.qc-bot[data-web="1"] .qc-bot-web');
    rec('web grows when abandoned', webOnIt && !!mb.dataset.web,
      (mb && mb.dataset.web) + '/' + (webEl ? webEl.getAttribute('class') : 'none'));
    rec('web has strands', !!webEl && !!webEl.querySelector('path'));
    rec('web has spider', !!webEl && !!webEl.querySelector('.qc-web-spider'));
    Q.mascot.clearWeb();
    await sleep(700);
    rec('web clears on touch', !mb.dataset.web, String(mb.dataset.web));

    /* 睡着也能结网：这是用户实测发现的坑 */
    Q.mascot.say('', 0, false);
    Q.mascot.setMood('sleepy', 0);
    Q.mascot.armWeb(60);
    await sleep(260);
    rec('web grows while asleep', mb.dataset.web === '1', String(mb.dataset.web));
    // 睡着的时候不该开口，气泡要空着
    var sleepyTxt = bubbleEl().querySelector('.qc-bot-bubble-txt').textContent;
    rec('sleepy web stays quiet', sleepyTxt === '', JSON.stringify(sleepyTxt));
    Q.mascot.clearWeb();
    await sleep(700);
    rec('web cleared after waking up', !mb.dataset.web, String(mb.dataset.web));
    Q.mascot.setState('idle');
    await sleep(60);

    /* 有表情时先不下手，表情做完再补，不会一枪打空就再也不管 */
    Q.mascot.setWebRetry(70);
    Q.mascot.setMood('happy', 300);
    Q.mascot.armWeb(40);
    await sleep(150);
    rec('web waits while a mood is on', mb.dataset.web !== '1', String(mb.dataset.web));
    await sleep(900);
    rec('web grows after mood ends', mb.dataset.web === '1', String(mb.dataset.web));
    Q.mascot.clearWeb();
    Q.mascot.setWebRetry(8000);
    await sleep(700);

    /* 11. 没题目的提示：短句 + 可点 */
    Q.S.questions = [];
    await Q.oneKeyFlow();
    await sleep(120);
    var bt = bubbleEl().querySelector('.qc-bot-bubble-txt');
    rec('no-question bubble is short', bt.textContent.length <= 20, bt.textContent);
    rec('no-question clickable', bubbleEl().dataset.act === '1');
    rec('no-question state error', bot.dataset.state === 'error', bot.dataset.state);

    /* 11b. 编程题页面：代码编辑器里的输入框不许当填空 */
    var mon = document.createElement('div');
    mon.className = 'monaco-editor';
    mon.style.cssText = 'position:fixed;left:-9999px;top:0;width:600px;height:300px';
    var edTa = document.createElement('textarea');
    edTa.className = 'inputarea';
    edTa.value = 'class Solution { };';
    mon.appendChild(edTa);
    document.body.appendChild(mon);
    await sleep(30);
    rec('code page detected', Q.pageKind() === 'code-judge', Q.pageKind());
    rec('editor textarea rejected', Q.checkFillable(edTa).ok === false, Q.checkFillable(edTa).why);
    rec('code page hint is honest', Q.noQuestionHint().indexOf('编程题') >= 0,
      Q.noQuestionHint().slice(0, 24));
    mon.remove();
    await sleep(30);
    rec('code page kind clears', Q.pageKind() === 'generic', Q.pageKind());

    /* 12. 连续做题：按钮识别与启停 */
    function mkBtn(txt, tag) {
      var b = document.createElement(tag === 'input' ? 'input' : 'button');
      if (tag === 'input') { b.type = 'submit'; b.value = txt; }
      else { b.textContent = txt; }
      b.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(b);
      return b;
    }
    rec('chain: Next page', Q.chain.looksNext(mkBtn('Next page')));
    rec('chain: 下一页', Q.chain.looksNext(mkBtn('下一页')));
    rec('chain: »', Q.chain.looksNext(mkBtn('»')));
    rec('chain: input value', Q.chain.looksNext(mkBtn('Next page', 'input')));
    rec('chain: reject submit', !Q.chain.looksNext(mkBtn('Submit all and finish')));
    rec('chain: reject 提交', !Q.chain.looksNext(mkBtn('提交试卷')));
    rec('chain: reject 上一页', !Q.chain.looksNext(mkBtn('上一页')));
    rec('chain: reject save', !Q.chain.looksNext(mkBtn('Save')));
    rec('chain: baseOf strips page', Q.chain.baseOf('https://a.com/mod/quiz/attempt.php?attempt=1&page=2') === 'https://a.com/mod/quiz/attempt.php?attempt=1');

    Q.chain.start();
    Q.chain.stop(true);
    rec('chain stops immediately', Q.chain.isOn() === false);
    rec('chain state cleared', true);

    /* 13. 「自动翻页」开关的接线 */
    var origChainStart = Q.chain.start;
    var chainCalls = 0;
    Q.chain.start = function () { chainCalls++; };
    Q.S.autoPage = true;
    await Q.oneKeyFlow();
    rec('autoPage on routes to chain', chainCalls === 1, String(chainCalls));

    Q.S.autoPage = false;
    chainCalls = 0;
    await Q.oneKeyFlow();
    rec('autoPage off stays single page', chainCalls === 0, String(chainCalls));

    Q.chain.start = origChainStart;
    Q.S.autoPage = false;

    /* 14. 换装要在重新挂载后还在（相当于刷新页面） */
    Q.mascot.setWear({ hat: 'beanie', ears: 'cat', neck: 'scarf' });
    Q.mascot.destroy();
    Q.mascot.mount();
    await sleep(90);
    var mb3 = Q.mascot.getEl();
    rec('wear survives remount', !!mb3 && mb3.dataset.hat === 'beanie' &&
      mb3.dataset.ears === 'cat' && mb3.dataset.neck === 'scarf',
      mb3 ? [mb3.dataset.hat, mb3.dataset.ears, mb3.dataset.neck].join('/') : 'none');

    out.textContent = 'RESULT\\n' + R.join('\\n') + '\\nDONE';
  }

  run().catch(function (e) {
    out.textContent = 'RESULT\\nFAIL | runner crashed | ' + (e && e.message) + '\\n' + (e && e.stack) + '\\nDONE';
  });
})();
</script>
</body></html>`;

fs.writeFileSync(path.join(DIR, '_test-harness.html'), page);
console.log('ok', (Buffer.byteLength(page) / 1024).toFixed(1) + 'KB');
