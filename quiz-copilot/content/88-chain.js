/* ============================================================
 * 答题助手 QuizCopilot — 连续做题
 * 文件：content/88-chain.js
 * 说明：答完一页自动点「下一页」，直到没有下一页为止。
 *       整页跳转会把 content script 整个重载，所以进度写在 storage.local，
 *       新页面启动时自己接上，不用人再点一次。
 *       绝不点「提交 / 交卷 / Finish attempt」——那是人该做的决定。
 * ============================================================ */
(() => {
  const Q = (window.__QC = window.__QC || {});
  const S = Q.S;

  const KEY = 'chainState';
  const MAX_PAGES = 30;          // 上限，防死循环
  const PAGE_TIMEOUT = 15000;    // 点完下一页等多久算失败
  const RESUME_TTL = 3 * 60 * 1000; // 跨页状态多久过期

  /* 只在按钮文字「以这些开头」时才认，避免把「下一页的说明」点掉 */
  const NEXT_CN = /^(下一页|下页|下一頁|下一题|下一題)/;
  const NEXT_EN = /^next(\s+(page|question))?\b/;
  const NEXT_ARROW = /^[›»>→]+$/;
  /* 出现这些词一律不点：提交类、返回类 */
  const STOP_RE = /(提交|交卷|结束|完成|保存|返回|上一页|上一步|上一頁|finish|submit|save|back|prev|previous|\bend\b|\bdone\b)/;

  let running = false;
  let stopFlag = false;
  let pages = 0;
  let total = 0;
  let resumePages = 0;
  let resumeTotal = 0;
  let savedAutoFill = null;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* 去掉 page 参数后的地址，用来判断「还是同一份卷子」 */
  function baseOf(href) {
    try {
      const u = new URL(href);
      u.searchParams.delete('page');
      u.hash = '';
      return u.href;
    } catch (e) {
      return String(href || '');
    }
  }

  function snapshot() {
    return {
      href: location.href,
      ctrl: document.querySelectorAll('input,textarea,select').length,
      title: document.title
    };
  }

  function visible(el) {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 6 || r.height < 6) return false;
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
  }

  function labelOf(el) {
    if (el.tagName === 'INPUT') return el.value || '';
    return el.innerText || el.textContent || '';
  }

  function looksNext(el) {
    const t = Q.oneLine(labelOf(el)).toLowerCase();
    const aria = Q.oneLine(el.getAttribute('aria-label') || '').toLowerCase();
    const rel = (el.getAttribute('rel') || '').toLowerCase();

    if (rel === 'next') return true;
    if (!t && !aria) return false;

    // 文案里出现提交/返回类字样，直接排除
    if (STOP_RE.test(t) || STOP_RE.test(aria)) return false;

    if (NEXT_CN.test(t) || NEXT_EN.test(t)) return true;
    if (NEXT_CN.test(aria) || NEXT_EN.test(aria)) return true;
    if (NEXT_ARROW.test(t)) return true;

    return false;
  }

  function findNext() {
    const nodes = document.querySelectorAll('a,button,input[type="submit"],input[type="button"],[role="button"]');
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      try {
        if (el.closest('#' + Q.HOST_ID)) continue;   // 不点自己的 UI
        if (el.disabled) continue;
        if (!visible(el)) continue;
        if (looksNext(el)) return el;
      } catch (e) {}
    }
    return null;
  }

  /* ---------- 进度存盘：整页跳转后靠它续上 ---------- */
  function saveState() {
    try {
      chrome.storage.local.set({
        [KEY]: {
          on: true,
          pages: pages,
          total: total,
          href: location.href,
          base: baseOf(location.href),
          updatedAt: Date.now()
        }
      });
    } catch (e) {}
  }

  function clearState() {
    try {
      chrome.storage.local.remove(KEY);
    } catch (e) {}
  }

  /* ---------- 点完下一页，等页面真的换掉 ---------- */
  async function waitForNewPage(prev) {
    const t0 = Date.now();
    while (Date.now() - t0 < PAGE_TIMEOUT) {
      await sleep(280);
      if (stopFlag) return false;
      const now = snapshot();
      if (now.href !== prev.href) return true;
      if (now.ctrl !== prev.ctrl) return true;
      if (now.title !== prev.title) return true;
    }
    // 兜底：上面都没变化，但题目变了也算翻页（URL 不变的局部刷新站点）
    try {
      const qs = Q.extractAll();
      const old = S.questions || [];
      const oldFirst = old[0] ? Q.oneLine(old[0].stem).slice(0, 40) : '';
      const newFirst = qs[0] ? Q.oneLine(qs[0].stem).slice(0, 40) : '';
      if (qs.length && (qs.length !== old.length || newFirst !== oldFirst)) return true;
    } catch (e) {}
    return false;
  }

  /* 新页面可能还没渲染完，先等出现可作答的控件，别一上来就判定「没题」 */
  async function waitForQuiz(maxMs) {
    const t0 = Date.now();
    while (Date.now() - t0 < (maxMs || 3000)) {
      if (document.readyState !== 'loading') {
        const n = document.querySelectorAll(
          'input[type="radio"],input[type="checkbox"],input[type="text"],textarea,select'
        ).length;
        if (n > 0) return true;
      }
      await sleep(200);
    }
    return false;
  }

  /* ---------- 完成 / 报错 ---------- */
  function finish(kind, msg) {
    clearState();
    const bot = Q.mascot;
    if (!bot) return;
    if (kind === 'done') {
      bot.setState('done');
      bot.say(msg, 0, true);
    } else if (kind === 'warn') {
      bot.setState('warn');
      bot.say(msg, 0, true);
    } else {
      bot.setState('error');
      bot.say(msg, 0, true);
    }
    bot.settleAfter(9000);
  }

  /* ---------- 主循环 ---------- */
  async function loop() {
    const bot = Q.mascot;

    while (!stopFlag) {
      if (pages >= MAX_PAGES) {
        finish('warn', `到 ${MAX_PAGES} 页上限了，先停一下`);
        return;
      }
      pages++;

      if (bot) {
        bot.setState('thinking');
        bot.say(`第 ${pages} 页，作答中…`, 0, false);
      }

      await waitForQuiz(3000);
      if (stopFlag) return;
      await Q.oneKeyFlow({ from: 'chain', redo: true });
      if (stopFlag) return;

      if (S.error) {
        finish('error', '作答出错：' + String(S.error).slice(0, 16));
        return;
      }
      if (!S.questions || !S.questions.length) {
        finish('error', '这页没读到题目，先停在这儿');
        return;
      }

      // 一题都没拿到答案，说明模型那边出问题了，别继续翻页
      const answered = S.questions.filter((q) => q.answer).length;
      if (!answered) {
        finish('error', '这页没拿到答案，先停在这儿');
        return;
      }
      total += answered;

      const btn = findNext();
      if (!btn) {
        finish('done', `全部做完：${pages} 页 / ${total} 题，检查后自己交卷`);
        return;
      }

      if (bot) bot.say(`第 ${pages} 页完成，翻页…`, 0, false);

      const prev = snapshot();
      // 关键：点之前先存。整页跳转会把当前脚本连同后面的代码一起销毁，
      // 存晚了就会出现「翻到第 2 页还显示第 1 页」。
      saveState();
      try {
        btn.click();
      } catch (e) {
        finish('error', '翻页按钮点不动');
        return;
      }

      const moved = await waitForNewPage(prev);
      if (stopFlag) return;
      if (!moved) {
        finish('warn', '翻页没反应，先停在这儿');
        return;
      }

      await sleep(500);
      saveState();
    }
  }

  async function start(keepPages) {
    if (running) return;
    if (Q.isBusy && Q.isBusy()) {
      if (Q.mascot) Q.mascot.say('正在处理，稍等一下', 2200, false);
      return;
    }

    running = true;
    stopFlag = false;
    pages = keepPages ? resumePages : 0;
    total = keepPages ? resumeTotal : 0;

    // 连续做题必须真的填进页面，否则翻页没意义；结束后还原用户的开关
    savedAutoFill = S.autoFill;
    S.autoFill = true;
    saveState();

    try {
      await loop();
    } finally {
      running = false;
      if (savedAutoFill !== null) {
        S.autoFill = savedAutoFill;
        savedAutoFill = null;
      }
    }
  }

  function stop(silent) {
    if (!running) {
      clearState();
      if (!silent && Q.mascot) Q.mascot.say('现在没在连续做题', 1800, false);
      return;
    }
    stopFlag = true;
    clearState();
    const bot = Q.mascot;
    if (bot) {
      bot.setState('idle');
      bot.say(`连续做题已停止（做到第 ${pages} 页）`, 3000, true);
    }
  }

  /* 新页面启动时调用：上一页刚点了「下一页」，这里自动接上 */
  function resume() {
    try {
      chrome.storage.local.get(KEY, (cfg) => {
        const c = cfg && cfg[KEY];
        if (!c || !c.on) return;
        if (Date.now() - (c.updatedAt || 0) > RESUME_TTL) return clearState();
        if (baseOf(location.href) !== c.base) return clearState();  // 不是同一份卷子
        if (location.href === c.href) return clearState();           // 这一页已经处理过了
        resumePages = Number(c.pages) || 0;
        resumeTotal = Number(c.total) || 0;
        setTimeout(() => {
          if (!running) start(true);
        }, 900);
      });
    } catch (e) {}
  }

  Q.chain = {
    start,
    stop,
    resume,
    findNext,
    looksNext,
    baseOf,
    isOn: () => running && !stopFlag,
    info: () => ({ on: running && !stopFlag, pages, max: MAX_PAGES })
  };
})();
