/* ============================================================
 * 答题助手 QuizCopilot — 调用 AI：拼 prompt、发请求、解析返回
 * 文件：content/45-solve.js
 * 说明：挂在 window.__QC 上，与其它模块共享；content script 的隔离环境，页面看不到
 * ============================================================ */
(() => {
  const Q = (window.__QC = window.__QC || {});
  const { HOST_ID, LETTERS, VER, S, norm, squash, oneLine, isVisible, esc, allDocs, countFrames, commonAncestor, OPT_CTRL_SEL, nearestOptionBox, BLANK_MARK, TYPE_CN, optionText, TRUE_RE, FALSE_RE, detectType, RE_OPT_LINE, NOISE_LINE, NOISE_INLINE, clampStem, cleanStemText, extractStem, inQuestionContainer, looksLikeQuizChoice, extractFromInputs, RE_QSTART, RE_OPT, parseTextToQuestions, NOT_QUIZ_SIG, NOT_QUIZ_CN, ANSWER_LABEL, PERSONAL_ID, checkFillable, isQuizFillable, nearbyLabelText, collectCandidates, looksLikeQuestion, blankContainer, stemWithBlanks, extractBlanks, SELECT_SKIP, rowDescriptor, stemOfContainer, matchContainer, extractMatches, pageKind, KIND_TEXT, noQuestionHint, diagnose, describeEl, finalize, extractAll, extractFromSelection } = Q;
  const setStatus = (...a) => Q.setStatus(...a);
  const render = (...a) => Q.render(...a);
  const fillAll = (...a) => Q.fillAll(...a);
  /* ============================================================
   * 五、调用 AI
   * ============================================================ */


  /* 模型表示「拿不到信息」的说法：出现这些就说明它在猜，别填 */
  const REFUSE = /(无具体信息|没有(具体)?信息|无法(确定|得知|判断|回答|获知)|不知道|不确定|需(要)?(你|用户|本人)|请自行|无法作答|不能确定)/;

  function buildPrompt(questions) {
    return questions
      .map((q) => {
        const head = `第${q.index}题【${TYPE_CN[q.type] || '单选'}】`;

        if (q.type === 'matrix') {
          const rows = q.rows || [];
          const cols = (q.cols || []).filter(Boolean);
          const n = rows.reduce((a, r) => a + r.blanks.length, 0);
          const lines = rows.map((r, i) => `第 ${i + 1} 行「${r.label}」：${r.blanks.length} 个空`);
          return [
            head,
            q.stem,
            cols.length ? '列：' + cols.join(' | ') : '',
            `这是一张表，共 ${rows.length} 行、${n} 个空：`,
            ...lines,
            `（按「第 1 行从左到右 → 第 2 行……」的顺序给出 ${n} 个答案，用 ||| 分隔。` +
              '如果是需要填你自己情况的数据（作息、收入、证件号等），你无从得知，就整题返回空字符串，不要编造，也不要写解释。）'
          ]
            .filter(Boolean)
            .join('\n');
        }

        if (q.type === 'essay') {
          const need = q.wordHint || (Q.essayWordHint ? Q.essayWordHint(q.stem) : '');
          return [
            head,
            q.stem,
            need ? `（题目要求 ${need}，请写足，不要低于下限）` : '',
            '（这是论述/简答题：如果题目给了两个或多个可选题，只挑一个写，第一行用「选择：第X题」标注；',
            '正文成段写、段落之间空一行；不要列小标题、不要写「答：」、不要用分号代替换行；只输出正文）'
          ]
            .filter(Boolean)
            .join('\n');
        }

        if (q.type === 'blank') {
          const n = (q.blanks || []).length || 1;
          const hint =
            n > 1
              ? `（本题共 ${n} 个空，按文中 ____ 出现的先后顺序作答，几个空的答案之间用 ||| 分隔，例：北京|||上海）`
              : '（请给出要填入横线处的文字，只给答案本身，不要带解释）';
          return (
            `${head}\n${q.stem}\n${hint}\n` +
            '（如果是需要填你自己情况的数据——作息、收入、证件号、手机号等，你无从得知，' +
            'answer 返回空字符串即可，不要编造，也不要把解释写进 answer）'
          );
        }

        if (q.type === 'match') {
          const n = (q.rows || []).length;
          const rows = (q.rows || [])
            .map((r, i) => `${i + 1}. ${r || '（这一项没有文字描述）'}`)
            .join('\n');
          return [
            head,
            q.stem,
            '待匹配项（按页面从上到下的顺序）：',
            rows,
            '可选答案：' + (q.choices || []).join('、'),
            `（这是匹配题，共 ${n} 项。请按 1、2、3… 的顺序，给出每一项对应的答案文字，` +
              '几个答案之间用 ||| 分隔，例：LinkedIn|||Snapchat。只写答案文字本身，不要写序号。' +
              '若某一项的描述只有图片文件名，请尽量按文件名推断。）'
          ].join('\n');
        }

        const opts = q.options.map((o) => `${o.letter}. ${o.text || '（空）'}`).join('\n');
        return `${head}\n${q.stem}\n${opts}`;
      })
      .join('\n\n');
  }

  /* ---------- 答案 / 解析对账 ---------- */
  /* 模型经常「解析里算到 1.41，answer 却写 1.00」，这里把它抓出来 */
  const CLAIM_RE = /(?:≈|=|等于|得到|结果为|应为|答案是)\s*(-?\d+(?:\.\d+)?)/g;

  function lastNumericClaim(reason) {
    const s = String(reason || '');
    if (!s) return null;
    CLAIM_RE.lastIndex = 0;
    let m = null;
    let last = null;
    while ((m = CLAIM_RE.exec(s)) !== null) last = m[1];
    if (last == null) return null;
    const n = Number(last);
    return isFinite(n) ? n : null;
  }

  /* 只对「答案是纯数值 + 解析给了明确数值」的题做检查，宁可不报也别误报 */
  function numericConflict(q) {
    if (!q || !q.answer) return null;
    if (q.type !== 'blank' && q.type !== 'matrix') return null;

    const ans = String(q.answer).trim();
    if (!/^-?\d+(?:\.\d+)?$/.test(ans)) return null;

    const claim = lastNumericClaim(q.reason);
    if (claim == null) return null;

    const a = Number(ans);
    if (!isFinite(a)) return null;

    const diff = Math.abs(a - claim);
    const tol = Math.max(0.02, Math.abs(claim) * 0.02);
    if (diff <= tol) return null;

    return { answer: ans, suggest: String(claim) };
  }

  // opts.autoFill === false 时不自动填（一键流程要自己控制节奏）
  async function solve(opts) {
    const allowAutoFill = !(opts && opts.autoFill === false);
    if (S.busy) return;
    if (!S.questions.length) {
      S.questions = extractAll();
    }
    if (!S.questions.length) {
      setStatus(noQuestionHint(), 'warn');
      render();
      return;
    }

    S.busy = true;
    S.error = '';
    setStatus(`正在让 AI 作答 ${S.questions.length} 道题…`, 'busy');
    render();

    try {
      const resp = await sendBg({ type: 'QC_SOLVE', text: buildPrompt(S.questions) });
      if (!resp || !resp.ok) throw new Error((resp && resp.error) || '调用失败');

      const byIndex = new Map();
      (resp.answers || []).forEach((a) => byIndex.set(Number(a.index), a));

      S.questions.forEach((q, i) => {
        const a = byIndex.get(q.index) || resp.answers[i] || null;
        q.answer = a ? a.answer : '';
        q.reason = a ? a.reason : '';
        q.fillState = '';

        // 模型自己都说「不知道」，就别把猜出来的数字填进页面（个人作息、收入这类）
        if ((q.type === 'blank' || q.type === 'matrix') && q.answer) {
          const parts = Q.splitBlankAnswer ? Q.splitBlankAnswer(q.answer) : [q.answer];
          const unsure = REFUSE.test(q.reason) || REFUSE.test(q.answer);
          if (unsure && parts.length <= 1) {
            q.reason = q.reason || q.answer;
            q.answer = '';
          }
        }

        // 答案和解析对不上时留个记号，面板会标出来，也能一键改用解析里的值
        q.conflict = numericConflict(q);
      });

      const missing = S.questions.filter((q) => !q.answer).length;
      S.lastUsage = resp.usage || null;
      setStatus(
        missing
          ? `完成，但有 ${missing} 道题没拿到答案，可点「重新作答」。`
          : `已作答 ${S.questions.length} 道题。`,
        missing ? 'warn' : 'ok'
      );

      if (allowAutoFill && S.autoFill) {
        fillAll();
      }
    } catch (e) {
      S.error = String(e && e.message || e);
      setStatus(S.error, 'error');
    } finally {
      S.busy = false;
      render();
    }
  }

  function sendBg(payload) {
    return new Promise((resolve, reject) => {
      let done = false;
      // 兜底超时，避免后台异常时面板一直卡在「作答中」
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        reject(new Error('等待响应超时。检查一下网络，或点「重新读取并解答」再试一次。'));
      }, 150000);

      const finish = (fn, val) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        fn(val);
      };

      try {
        chrome.runtime.sendMessage(payload, (resp) => {
          const le = chrome.runtime.lastError;
          if (le) {
            finish(
              reject,
              new Error(
                /Extension context invalidated/i.test(le.message || '')
                  ? '扩展刚刚被更新或重新加载了，请刷新这个页面（F5）再试。'
                  : le.message
              )
            );
            return;
          }
          finish(resolve, resp);
        });
      } catch (e) {
        finish(
          reject,
          new Error(
            /Extension context invalidated/i.test(String(e && e.message))
              ? '扩展刚刚被更新或重新加载了，请刷新这个页面（F5）再试。'
              : String(e && e.message || e)
          )
        );
      }
    });
  }


  Object.assign(Q, { buildPrompt, solve, sendBg, lastNumericClaim, numericConflict });
})();
