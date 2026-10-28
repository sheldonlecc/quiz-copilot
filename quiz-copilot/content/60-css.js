/* ============================================================
 * 答题助手 QuizCopilot — 面板样式（Shadow DOM 内使用）
 * 文件：content/60-css.js
 * 说明：挂在 window.__QC 上，与其它模块共享；content script 的隔离环境，页面看不到
 * ============================================================ */
(() => {
  const Q = (window.__QC = window.__QC || {});
  const { HOST_ID, LETTERS, VER, S, norm, squash, oneLine, isVisible, esc, allDocs, countFrames, commonAncestor, OPT_CTRL_SEL, nearestOptionBox, BLANK_MARK, TYPE_CN, optionText, TRUE_RE, FALSE_RE, detectType, RE_OPT_LINE, NOISE_LINE, NOISE_INLINE, clampStem, cleanStemText, extractStem, inQuestionContainer, looksLikeQuizChoice, extractFromInputs, RE_QSTART, RE_OPT, parseTextToQuestions, NOT_QUIZ_SIG, NOT_QUIZ_CN, ANSWER_LABEL, PERSONAL_ID, checkFillable, isQuizFillable, nearbyLabelText, collectCandidates, looksLikeQuestion, blankContainer, stemWithBlanks, extractBlanks, SELECT_SKIP, rowDescriptor, stemOfContainer, matchContainer, extractMatches, pageKind, KIND_TEXT, noQuestionHint, diagnose, describeEl, finalize, extractAll, extractFromSelection, buildPrompt, solve, sendBg, targetOptions, clickInput, splitBlankAnswer, setNativeValue, answerDisplay, pickSelectOption, setSelectValue, fillBlank, fillOne, buildTextIndex, findClickableByText, fillAll } = Q;
  /* ============================================================
   * 七、面板 UI（Shadow DOM，避免被页面样式污染）
   * ============================================================ */

  const CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; }

  .qc-wrap {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
    font-size: 13px; line-height: 1.55; color: #e8eaef;
    width: 400px; max-width: calc(100vw - 40px);
    max-height: calc(100vh - 120px);
    display: flex; flex-direction: column;
    background: #15171e;
    border: 1px solid rgba(255,255,255,.09);
    border-radius: 14px;
    box-shadow: 0 20px 56px rgba(0,0,0,.6), 0 2px 10px rgba(0,0,0,.4);
    overflow: hidden;
  }

  .qc-head {
    display: flex; align-items: center; gap: 8px;
    padding: 11px 13px;
    background: #191c24;
    border-bottom: 1px solid rgba(255,255,255,.07);
    flex: 0 0 auto;
  }
  .qc-logo {
    width: 21px; height: 21px; border-radius: 6px; flex: 0 0 auto;
    background: linear-gradient(135deg, #4f8cff, #7c5cff);
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 700; color: #fff; letter-spacing: -.3px;
  }
  .qc-title { font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
  .qc-ver {
    font-family: ui-monospace, Consolas, monospace;
    font-size: 9.5px; font-weight: 500; color: #76808f;
    background: rgba(255,255,255,.06);
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 4px; padding: 0 4px; line-height: 15px; letter-spacing: .2px;
  }
  .qc-count {
    margin-left: auto;
    font-size: 11px; color: #9dc0ff;
    background: rgba(79,140,255,.13);
    border: 1px solid rgba(79,140,255,.26);
    border-radius: 20px; padding: 1px 9px;
  }
  .qc-count.zero { color: #7f8a9c; background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.1); }
  .qc-x {
    width: 22px; height: 22px; border-radius: 6px; border: none; cursor: pointer;
    background: transparent; color: #7f8a9c; font-size: 15px; line-height: 1;
    display: flex; align-items: center; justify-content: center; transition: .12s;
  }
  .qc-x:hover { background: rgba(255,255,255,.08); color: #fff; }

  /* ---- 两步主操作 ---- */
  .qc-acts { display: flex; gap: 8px; padding: 11px 13px 9px; flex: 0 0 auto; }
  .qc-step {
    flex: 1 1 0; min-width: 0;
    display: flex; align-items: center; gap: 9px;
    padding: 8px 11px; border-radius: 10px; cursor: pointer;
    border: 1px solid rgba(255,255,255,.1);
    background: #1c1f27; color: #c9cfd9;
    font-family: inherit; text-align: left;
    transition: .13s;
  }
  .qc-step:hover:not(:disabled) { background: #232733; border-color: rgba(255,255,255,.18); }
  .qc-step:disabled { opacity: .4; cursor: not-allowed; }
  .qc-step.main {
    background: linear-gradient(135deg, #3b7bff, #5b5bf0);
    border-color: transparent; color: #fff;
  }
  .qc-step.main:hover:not(:disabled) { filter: brightness(1.1); }
  .qc-step-no {
    width: 19px; height: 19px; border-radius: 50%; flex: 0 0 auto;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700;
    background: rgba(255,255,255,.16);
  }
  .qc-step.main .qc-step-no { background: rgba(255,255,255,.26); }
  .qc-step-txt { display: flex; flex-direction: column; min-width: 0; }
  .qc-step-main { font-size: 12.5px; font-weight: 600; white-space: nowrap; }
  .qc-step-sub {
    font-size: 11px; opacity: .6; margin-top: 1px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  /* ---- 次级工具 ---- */
  .qc-tools {
    display: flex; align-items: center; gap: 1px;
    padding: 0 11px 9px; flex: 0 0 auto;
  }
  .qc-tool {
    font-family: inherit; font-size: 11.5px; cursor: pointer;
    padding: 3px 7px; border-radius: 6px;
    border: none; background: transparent; color: #8b93a3;
    display: flex; align-items: center; gap: 6px;
    transition: .12s; white-space: nowrap;
  }
  .qc-tool:hover { background: rgba(255,255,255,.07); color: #d7dbe2; }
  .qc-sep { width: 1px; height: 11px; background: rgba(255,255,255,.12); margin: 0 3px; flex: 0 0 auto; }
  .qc-auto { margin-left: auto; }
  .qc-track {
    width: 24px; height: 13px; border-radius: 7px;
    background: #333845; position: relative; transition: .16s; flex: 0 0 auto;
  }
  .qc-track i {
    position: absolute; top: 2px; left: 2px;
    width: 9px; height: 9px; border-radius: 50%;
    background: #8b93a3; transition: .16s;
  }
  .qc-auto.on .qc-track { background: rgba(79,140,255,.5); }
  .qc-auto.on .qc-track i { left: 13px; background: #6ba4ff; }
  .qc-auto.on { color: #9dc0ff; }

  /* ---- 列表 ---- */
  .qc-list { overflow-y: auto; padding: 3px 11px 10px; flex: 1 1 auto; min-height: 40px; }
  .qc-list::-webkit-scrollbar { width: 8px; }
  .qc-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,.13); border-radius: 8px; }
  .qc-list::-webkit-scrollbar-track { background: transparent; }

  .qc-card {
    background: #1a1d25;
    border: 1px solid rgba(255,255,255,.07);
    border-radius: 11px;
    padding: 10px 11px 9px;
    margin-bottom: 8px;
  }
  .qc-card.fail { border-color: rgba(248,113,113,.42); }
  .qc-card-hd { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
  .qc-idx {
    font-size: 10.5px; font-weight: 600; color: #9dc0ff;
    background: rgba(79,140,255,.14);
    border-radius: 5px; padding: 0 6px; line-height: 17px;
  }
  .qc-type {
    font-size: 10px; color: #7f8a9c;
    border: 1px solid rgba(255,255,255,.11);
    border-radius: 4px; padding: 0 5px; line-height: 15px;
  }
  .qc-stem {
    color: #cdd3dd; font-size: 12.5px; line-height: 1.5;
    display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
    overflow: hidden; margin-bottom: 7px;
  }

  .qc-band {
    background: rgba(52,211,153,.07);
    border: 1px solid rgba(52,211,153,.2);
    border-radius: 8px;
    padding: 6px 9px;
    margin-bottom: 6px;
    display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap;
  }
  .qc-band.empty { background: rgba(251,191,36,.06); border-color: rgba(251,191,36,.22); }
  .qc-band-k {
    font-size: 12.5px; font-weight: 700; color: #6ee7a8; letter-spacing: .4px;
    background: rgba(110,231,168,.13);
    border-radius: 5px; padding: 0 7px; line-height: 19px; flex: 0 0 auto;
  }
  .qc-band.empty .qc-band-k {
    color: #fbbf24; background: rgba(251,191,36,.12); font-weight: 500; letter-spacing: 0;
  }
  .qc-band-v { font-size: 12.5px; color: #d7f5e4; flex: 1 1 auto; min-width: 0; word-break: break-word; }
  .qc-band.empty .qc-band-v { color: #c2ad82; }
  .qc-band-row { display: flex; gap: 7px; width: 100%; font-size: 12.5px; }
  .qc-band-row + .qc-band-row { margin-top: 4px; }
  .qc-band-n { color: #6ee7a8; font-weight: 600; flex: 0 0 auto; min-width: 12px; }

  .qc-reason {
    font-size: 11.5px; color: #7f8a9c; line-height: 1.5;
    padding-left: 8px; border-left: 2px solid rgba(255,255,255,.1);
    margin-bottom: 7px;
  }

  /* ---- 答案与解析对不上 ---- */
  .qc-conflict {
    display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
    background: rgba(251,191,36,.08);
    border: 1px solid rgba(251,191,36,.32);
    border-radius: 8px;
    padding: 6px 8px; margin-bottom: 7px;
    font-size: 11.5px; color: #e3bd76; line-height: 1.45;
  }
  .qc-conflict span { flex: 1 1 auto; min-width: 0; }
  .qc-conflict b { color: #ffd98a; font-weight: 700; }
  .qc-conflict .qc-mini {
    flex: 0 0 auto; color: #ffd98a;
    border-color: rgba(251,191,36,.42);
  }
  .qc-conflict .qc-mini:hover {
    color: #1b1f28; background: #ffd98a; border-color: transparent;
  }

  /* ---- 划词解释卡片 ---- */
  .qc-exp {
    background: rgba(79,140,255,.06);
    border: 1px solid rgba(79,140,255,.24);
    border-radius: 11px;
    padding: 9px 10px 10px;
    margin: 3px 0 8px;
  }
  .qc-exp.bad { border-color: rgba(248,113,113,.4); background: rgba(248,113,113,.06); }
  .qc-exp-hd {
    display: flex; align-items: center; gap: 6px;
    font-size: 11.5px; font-weight: 600; color: #9dc0ff;
    margin-bottom: 6px;
  }
  .qc-exp-hd span { flex: 1 1 auto; }
  .qc-exp-src {
    font-size: 11.5px; color: #8b93a3; line-height: 1.5;
    border-left: 2px solid rgba(79,140,255,.35);
    padding-left: 8px; margin-bottom: 7px;
    display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
    overflow: hidden; word-break: break-word;
  }
  .qc-exp-body {
    font-size: 12.5px; color: #cdd3dd; line-height: 1.65;
    white-space: pre-wrap; word-break: break-word;
  }
  .qc-exp-body.loading { color: #7f8a9c; }
  .qc-exp-body.bad { color: #ffb3b3; }
  .qc-card-acts { display: flex; gap: 6px; }
  .qc-mini {
    font-family: inherit; font-size: 11px; cursor: pointer;
    padding: 2px 9px; border-radius: 5px;
    border: 1px solid rgba(255,255,255,.11);
    background: transparent; color: #8b93a3;
    transition: .12s;
  }
  .qc-mini:hover { color: #fff; border-color: rgba(255,255,255,.26); background: rgba(255,255,255,.05); }

  .qc-empty {
    color: #7f8a9c; font-size: 12px; text-align: center;
    padding: 26px 18px; line-height: 1.8;
  }
  .qc-empty b { color: #9dc0ff; font-weight: 600; }
  .qc-empty .qc-empty-h { color: #c9cfd9; font-size: 13px; display: block; margin-bottom: 8px; }

  .qc-diag { padding: 2px 0; }
  .qc-diag-hd {
    display: flex; align-items: center; gap: 6px;
    font-size: 12px; color: #9dc0ff; font-weight: 600;
    padding: 4px 2px 7px;
  }
  .qc-diag-hd span { flex: 1 1 auto; }
  .qc-diag-body {
    font-family: ui-monospace, Consolas, "Cascadia Code", monospace;
    font-size: 11px; line-height: 1.65; color: #a9b2c0;
    background: #0f1218;
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 8px; padding: 10px; margin: 0;
    max-height: 320px; overflow: auto;
    white-space: pre-wrap; word-break: break-all;
  }

  .qc-foot {
    padding: 8px 13px; font-size: 11.5px;
    border-top: 1px solid rgba(255,255,255,.07);
    background: #12141a; color: #8b93a3;
    flex: 0 0 auto; display: flex; align-items: center; gap: 7px;
  }
  .qc-dot { width: 6px; height: 6px; border-radius: 50%; background: #6b7280; flex: 0 0 auto; }
  .qc-foot.ok .qc-dot { background: #34d399; }
  .qc-foot.warn .qc-dot { background: #fbbf24; }
  .qc-foot.error .qc-dot { background: #f87171; }
  .qc-foot.busy .qc-dot { background: #60a5fa; animation: qc-pulse 1s infinite; }
  @keyframes qc-pulse { 0%,100% { opacity: 1 } 50% { opacity: .3 } }
  .qc-foot span { flex: 1 1 auto; }

  .qc-fab {
    position: fixed; right: 18px; bottom: 22px; z-index: 2147483646;
    width: 40px; height: 40px; border-radius: 12px; border: none; cursor: pointer;
    background: linear-gradient(135deg, #3b7bff, #6b5cf0);
    color: #fff; font-family: inherit; font-size: 12px; font-weight: 700;
    box-shadow: 0 6px 20px rgba(59,123,255,.45), 0 2px 6px rgba(0,0,0,.3);
    opacity: .82; transition: .15s;
    display: flex; align-items: center; justify-content: center;
  }
  .qc-fab:hover { opacity: 1; transform: translateY(-1px); }
  `

  Object.assign(Q, { CSS });
})();
