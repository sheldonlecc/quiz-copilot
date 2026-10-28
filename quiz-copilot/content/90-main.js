/* ============================================================
 * 答题助手 QuizCopilot — 启动、快捷键、一键解题、消息路由
 * 文件：content/90-main.js
 * ============================================================ */
(() => {
  const Q = (window.__QC = window.__QC || {});
  if (Q.__booted) return;
  Q.__booted = true;

  const { S, extractAll, openPanel, togglePanel, render, solve, fillAll, noQuestionHint, diagnose } = Q;

  let flowBusy = false;

  /* ---------- 一键解题：读题 → 作答 →（自动填开着时）填入 ---------- */
  /* 「自动填」开着：点完直接把答案写进页面。
     关着：只算出答案，弹个气泡提示可以看详情。 */
  async function oneKeyFlow(opts) {
    const bot = Q.mascot;
    if (!bot) return;
    const fromChain = !!(opts && opts.from === 'chain');

    // 连续模式跑着的时候再点机器人 = 停下，别又叠一层
    if (!fromChain && Q.chain && Q.chain.isOn()) {
      Q.chain.stop();
      return;
    }

    // 「自动翻页」开着：点一下就走连续流程（chain 内部会再调回来，别递归）
    if (!fromChain && S.autoPage && Q.chain) {
      Q.chain.start();
      return;
    }

    // 已经答完时，再点机器人 = 打开面板看答案
    const st = bot.getState();
    if ((st === 'done' || st === 'warn') && S.questions.length && !(opts && opts.redo)) {
      openPanel();
      render();
      return;
    }
    if (flowBusy || S.busy) return;

    flowBusy = true;
    S.diag = '';
    S.error = '';
    try {
      bot.setState('thinking');
      bot.say('正在读题…', 0);
      render();

      const qs = extractAll();
      if (!qs.length) {
        bot.setState('error');
        // 气泡只说结论，具体原因放在面板里，别把一整段诊断塞进气泡
        bot.say('这页没认出题目，点这里看原因', 9000, true);
        bot.settleAfter(10000);
        return;
      }

      S.questions = qs;
      render();
      bot.say(`读到 ${qs.length} 题，作答中…`, 0);

      // 作答阶段先别自动填，把「填」留成独立一步，节奏才看得见
      await solve({ autoFill: false });

      if (S.error) {
        bot.setState('error');
        bot.say('作答失败：' + String(S.error).slice(0, 22), 6000, true);
        bot.settleAfter(7000);
        return;
      }

      const answered = S.questions.filter((q) => q.answer).length;
      const conflict = S.questions.filter((q) => q.conflict).length;
      if (!answered) {
        bot.setState('error');
        bot.say('没拿到答案', 6000, true);
        bot.settleAfter(7000);
        return;
      }

      // 自动填开着 → 直接写进页面
      if (!S.autoFill) {
        bot.setState(conflict ? 'warn' : 'done');
        bot.say(conflict ? `答完 ${answered} 题，${conflict} 题与解析对不上` : `答完 ${answered} 题，点这里看答案`, 0, true);
        bot.settleAfter(4200);
        return;
      }

      bot.say(`正在填入 ${answered} 题…`, 0);
      const st2 = fillAll() || { ok: 0, total: answered, fail: 0 };
      const total = st2.total || answered;

      if (st2.fail || conflict) {
        bot.setState('warn');
        bot.say(
          conflict
            ? `已填 ${st2.ok}/${total}，${conflict} 题与解析对不上`
            : `已填 ${st2.ok}/${total}，${st2.fail} 题需手动`,
          0,
          true
        );
        bot.settleAfter(4200);
      } else {
        bot.setState('done');
        bot.say(`已填 ${st2.ok} 题，点这里核对`, 0, true);
        bot.settleAfter(4200);
      }
    } catch (e) {
      bot.setState('error');
      bot.say(String((e && e.message) || e).slice(0, 30), 6000, true);
      bot.settleAfter(7000);
    } finally {
      flowBusy = false;
    }
  }

  Q.oneKeyFlow = oneKeyFlow;
  Q.isBusy = () => flowBusy || S.busy;

  /* ---------- 两个开关的联动 ---------- */
  /* 连做必须把答案写进页面，否则翻页没有意义；所以不允许「翻页开、自动填关」这种组合 */
  Q.setAutoFill = (on) => {
    S.autoFill = !!on;
    if (!S.autoFill) S.autoPage = false;
    try {
      chrome.storage.sync.set({ autoFill: S.autoFill, autoPage: S.autoPage });
    } catch (e) {}
  };

  Q.setAutoPage = (on) => {
    S.autoPage = !!on;
    if (S.autoPage) S.autoFill = true;
    try {
      chrome.storage.sync.set({ autoFill: S.autoFill, autoPage: S.autoPage });
    } catch (e) {}
  };

  Q.setPageLimit = (n) => {
    const v = Math.max(1, Math.min(200, Math.round(Number(n) || 30)));
    S.pageLimit = v;
    try {
      chrome.storage.sync.set({ pageLimit: v });
    } catch (e) {}
  };

  /* 气泡上那个「详情」：没读到题就把完整诊断摊开，读完题就直接看答案 */
  Q.bubbleAction = () => {
    if (!S.questions.length && !S.diag && diagnose) S.diag = diagnose();
    openPanel();
    render();
  };

  /* ---------- 来自后台 / 弹窗的消息 ---------- */
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'QC_TOGGLE_PANEL') {
      togglePanel();
      sendResponse({ ok: true, open: !!(S.panelEl && S.panelEl.isConnected) });
      return true;
    }

    if (msg.type === 'QC_ONEKEY') {
      oneKeyFlow();
      sendResponse({ ok: true });
      return true;
    }

    if (msg.type === 'QC_PING') {
      sendResponse({ ok: true, hasPanel: !!(S.panelEl && S.panelEl.isConnected) });
      return true;
    }

    if (msg.type === 'QC_START') {
      openPanel();
      S.questions = extractAll();
      render();
      if (S.questions.length) solve();
      sendResponse({ ok: true, count: S.questions.length });
      return true;
    }
  });

  /* ---------- 启动 ---------- */
  function boot() {
    try {
      chrome.storage.sync.get(
        { autoFill: true, showFab: true, botSkin: 'blue', selExplain: true, autoPage: false, pageLimit: 30, pomoCustom: 25 },
        (cfg) => {
        S.autoFill = !!cfg.autoFill;
        S.autoPage = !!cfg.autoPage;
        // 兼容老配置：出现「翻页开、填关」就按联动规则修正
        if (S.autoPage) S.autoFill = true;
        S.pageLimit = Number(cfg.pageLimit) || 30;
        S.pomoCustom = Number(cfg.pomoCustom) || 25;
        S.showFab = cfg.showFab !== false;
        S.selExplain = cfg.selExplain !== false;
        S.skin = cfg.botSkin || 'blue';
        if (Q.mascot) {
          Q.mascot.mount();
          if (Q.mascot.setSkin) Q.mascot.setSkin(S.skin);
        }
        if (Q.menu && Q.menu.mount) Q.menu.mount();
        if (Q.pomo && Q.pomo.init) Q.pomo.init();
        if (Q.sel && Q.sel.init) Q.sel.init();
        // 上一页刚点过「下一页」的话，这里接着做
        if (Q.chain && Q.chain.resume) setTimeout(() => Q.chain.resume(), 500);
      });
    } catch (e) {}

    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'sync') return;
        if (changes.autoFill || changes.autoPage) {
          if (changes.autoFill) S.autoFill = !!changes.autoFill.newValue;
          if (changes.autoPage) S.autoPage = !!changes.autoPage.newValue;
          // 无论从哪个入口改，最后都收敛到「翻页开 → 填一定开」
          if (S.autoPage) S.autoFill = true;
          if (!S.autoFill) S.autoPage = false;
        }
        if (changes.pageLimit) S.pageLimit = Number(changes.pageLimit.newValue) || 30;
        if (changes.pomoCustom) S.pomoCustom = Number(changes.pomoCustom.newValue) || 25;
        if (changes.selExplain) S.selExplain = changes.selExplain.newValue !== false;
        if (changes.botSkin) {
          S.skin = changes.botSkin.newValue || 'blue';
          if (Q.mascot && Q.mascot.setSkin) Q.mascot.setSkin(S.skin);
        }
        if (changes.showFab) {
          S.showFab = changes.showFab.newValue !== false;
          if (!Q.mascot) return;
          if (S.showFab) Q.mascot.mount();
          Q.mascot.show(S.showFab);
          // 重新挂载后计时牌是新的，把当前剩余时间补画上去
          if (Q.pomo && Q.pomo.repaint) Q.pomo.repaint();
        }
      });
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
