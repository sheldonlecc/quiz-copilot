/* ============================================================
 * 答题助手 QuizCopilot — background service worker
 * 职责：保管配置、代理 AI 接口调用（绕开页面 CORS）、转发快捷键
 * ============================================================ */

const DEFAULTS = {
  baseUrl: 'https://api.deepseek.com/v1',
  apiKey: '',
  model: 'deepseek-chat',
  autoFill: false,
  showFab: true,
  temperature: 0.2
};

const SYSTEM_PROMPT = [
  '你是一个严谨的答题助手。用户会给你从网页上抓取的题目（可能带有少量噪声），请逐题作答。',
  '',
  '输出要求（必须严格遵守）：',
  '1. 只输出一个 JSON 对象，不要输出 markdown 代码块，不要任何额外的说明文字。',
  '2. JSON 结构固定为：{"answers":[{"index":1,"answer":"A","reason":"简要解析"}]}',
  '3. index 与输入题号一致，不要跳号、不要重排。',
  '4. answer 的取值规则：',
  '   - 单选题：一个选项字母，如 "A"',
  '   - 多选题：多个字母连写，不带空格和标点，如 "ACD"',
  '   - 判断题：只能是 "对" 或 "错"',
  '   - 填空题：直接给出要填入横线处的文字，只写答案本身，不要带序号、不要带解释；',
  '     若一题有多个空，按 ____ 出现的先后顺序作答，几个空的答案之间用 ||| 分隔，如 "北京|||上海"。',
  '     （填空题的 answer 里不要出现选项字母，也不要写"答案是"之类的字样）',
  '   - 匹配题：按题目里「待匹配项」的编号顺序，给出每一项对应的答案文字（必须从「可选答案」里选），',
  '     多个答案之间同样用 ||| 分隔，如 "LinkedIn|||Snapchat|||Instagram"。只写答案文字，不要写序号。',
  '     如果某一项给出的描述是图片文件名（方括号里那种，如 [linkedin]），就按文件名推断它是什么。',
  '5. 每一题都必须给出答案，不允许遗漏、不允许空字符串。实在不确定时给出最可能的答案。',
  '6. reason 用中文，控制在 80 字以内，说明判断的关键依据。',
  '7. 如果题目内容明显残缺或无法理解，answer 填 "A"，reason 写 "题干不完整，建议人工核对"。',
  '8. 计算题、数值填空题：必须先把算式在 reason 里算完，再把算式的最终结果原样写进 answer。',
  '   answer 与 reason 里最后一个「=」或「≈」后面的数值必须完全相同，不能一个写 1.00、另一个写 1.41。',
  '   题目要求保留两位小数时，answer 也保留两位（如 "1.41"）；题目没要求时，按计算结果的自然精度给出。',
  '9. 如果同一题你算了两遍得到不同结果，以最后一次完整计算的结论为准，并只把那个数写进 answer。',
  '10. 论述题 / 简答题：answer 直接给完整正文，不要写「答：」，段落之间用两个换行分隔；',
  '    题目写了字数要求（例如 700-1000 字）就必须写足，不要明显低于下限；',
  '    题目给多个可选题时只写一个，并在第一行用「选择：第X题」标注；',
  '    不要列小标题、不要用分号把整篇串成一段；reason 只写一句主旨，不要重复正文。'
].join('\n');

/* 划词解释用的提示词：不答题，只讲人话 */
const EXPLAIN_PROMPT = [
  '你是一个讲课很清楚的助教。用户会给你从网页上选中一小段文字（可能是教材、题目、代码、英文段落），请你用中文解释它。',
  '',
  '要求：',
  '1. 先用一句话说清“这段在讲什么”，再展开关键点；',
  '2. 遇到专业术语，用类比或生活化的例子讲明白；',
  '3. 如果这段是英文，先给中文意思，再解释难点；',
  '4. 控制在 200 字以内，不要开场客套，不要重复原文；',
  '5. 如果这段文字本身残缺、没有上下文导致无法判断，就直接说明“信息不足”，不要编造。',
  '6. 只输出解释正文，不要用 markdown 标题、不要加“解释：”前缀。'
].join('\n');

/* 编程题用的提示词：要的是「思路 + 一段能直接提交的代码」，不走 JSON */
const CODE_PROMPT = [
  '你是一个编程题的解题助手。用户会给你一道在线判题平台的题目，可能还附带编辑器里已有的代码模板。',
  '',
  '输出格式（必须严格遵守，不要输出 JSON，不要输出任何别的东西）：',
  '思路：<3-5 句话，先说用什么算法或数据结构，再说为什么，最后一句说明边界情况怎么处理>',
  '复杂度：时间 O(...)，空间 O(...)',
  '```',
  '<完整代码>',
  '```',
  '',
  '要求：',
  '1. 代码必须完整、可直接提交：需要 include / import 的写上；模板里给出的函数名、类名、参数不要改；',
  '2. 模板是「函数题」（已经给了 class Solution / def 之类）就只补全函数体，不要写 main、不要写输入输出；',
  '   没有模板或模板为空时按「ACM 模式」写完整程序（自己读输入、自己输出）；',
  '3. 不要写测试用例、不要打印调试信息、不要留 TODO；',
  '4. 关键步骤写一句注释即可，不要整段注释，也不要把解释写进代码；',
  '5. 空输入、单元素、负数、溢出这类边界自己处理，并在「思路」里点一句；',
  '6. 题目信息缺失（输入范围、返回格式没给全）时按最常见约定实现，并在「思路」最后一句写明你的假设。'
].join('\n');

/* ---------------- 配置 ---------------- */

async function getConfig() {
  const cfg = await chrome.storage.sync.get(DEFAULTS);
  return { ...DEFAULTS, ...cfg };
}

/* ---------------- 接口调用 ---------------- */

function endpointOf(baseUrl) {
  let b = String(baseUrl || '').trim().replace(/\/+$/, '');
  if (!b) b = DEFAULTS.baseUrl;
  if (/\/chat\/completions$/i.test(b)) return b;
  return b + '/chat/completions';
}

function friendlyHttpError(status, bodyText) {
  const snippet = String(bodyText || '').slice(0, 300);
  if (status === 401 || status === 403) return `API Key 无效或没有该模型权限（${status}）。请到扩展设置里重新填写。`;
  if (status === 402) return '账户余额不足（402）。请到模型服务商后台充值。';
  if (status === 404) return `接口地址不对（404）。请检查 Base URL 是否包含 /v1，以及模型名是否存在。${snippet ? ' 服务端提示：' + snippet : ''}`;
  if (status === 429) return '请求过于频繁或超出额度（429）。等一会儿再试，或换个模型。';
  if (status >= 500) return `模型服务端出错（${status}），稍后重试。`;
  return `请求失败（${status}）：${snippet}`;
}

async function postChat(cfg, body, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs || 90000);
  try {
    const res = await fetch(endpointOf(cfg.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + (cfg.apiKey || '').trim()
      },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
    const raw = await res.text();
    if (!res.ok) {
      const err = new Error(friendlyHttpError(res.status, raw));
      err.status = res.status;
      throw err;
    }
    let json;
    try {
      json = JSON.parse(raw);
    } catch (e) {
      throw new Error('接口返回的不是 JSON，Base URL 可能填错了。返回内容开头：' + raw.slice(0, 160));
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

async function callChat(userText, opts = {}) {
  const cfg = await getConfig();
  if (!cfg.apiKey || !cfg.apiKey.trim()) {
    throw new Error('还没有填写 API Key。点浏览器右上角的扩展图标，填入 Key 并保存即可。');
  }

  const base = {
    model: cfg.model || DEFAULTS.model,
    temperature: typeof cfg.temperature === 'number' ? cfg.temperature : 0.2,
    // 论述题要写 700-1000 字，默认上限不够；显式给足，短题也不受影响
    max_tokens: opts.maxTokens || 4000,
    messages: [
      { role: 'system', content: opts.system || SYSTEM_PROMPT },
      { role: 'user', content: userText }
    ]
  };

  let json;
  try {
    json = await postChat(cfg, { ...base, response_format: { type: 'json_object' } }, opts.timeout);
  } catch (e) {
    // 有些兼容接口不支持 response_format，去掉后重试一次
    const msg = String(e && e.message || '');
    const retryable = e.status === 400 || /response_format|json_object|unsupported|invalid.*param/i.test(msg);
    if (!retryable) throw e;
    json = await postChat(cfg, base, opts.timeout);
  }

  const content = json?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('模型没有返回内容。原始响应：' + JSON.stringify(json).slice(0, 300));
  }
  return { content, usage: json.usage || null, model: json.model || cfg.model };
}

/* 纯文本通道：不要求 JSON，直接拿回复（划词解释、摘要都用它） */
async function callChatPlain(userText, system, timeout) {
  const cfg = await getConfig();
  if (!cfg.apiKey || !cfg.apiKey.trim()) {
    throw new Error('还没有填写 API Key。点浏览器右上角的扩展图标，填入 Key 并保存即可。');
  }
  const json = await postChat(
    cfg,
    {
      model: cfg.model || DEFAULTS.model,
      temperature: 0.3,
      messages: [
        { role: 'system', content: system || EXPLAIN_PROMPT },
        { role: 'user', content: userText }
      ]
    },
    timeout || 60000
  );
  const content = json?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('模型没有返回内容。原始响应：' + JSON.stringify(json).slice(0, 300));
  }
  return { content: String(content).trim(), usage: json.usage || null };
}

/* ---------------- 答案解析 ---------------- */

function parseAnswers(content) {
  let s = String(content || '').trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  if (!s) throw new Error('模型返回了空内容。');

  const attempt = (str) => {
    try {
      return JSON.parse(str);
    } catch (e) {
      return undefined;
    }
  };

  let obj = attempt(s);

  if (obj === undefined) {
    // 从第一层 { 或 [ 开始截取，容忍前后夹杂说明文字
    const iObj = s.indexOf('{');
    const iArr = s.indexOf('[');
    let start = -1;
    if (iArr >= 0 && (iObj < 0 || iArr < iObj)) start = iArr;
    else if (iObj >= 0) start = iObj;

    const candidates = [];
    if (start >= 0) {
      const end = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
      if (end > start) candidates.push(s.slice(start, end + 1));
    }
    candidates.push(s);

    for (const c of candidates) {
      obj = attempt(c);
      if (obj === undefined) obj = attempt(c.replace(/,\s*([}\]])/g, '$1'));
      if (obj !== undefined) break;
    }
  }

  if (obj === undefined) {
    throw new Error('模型返回的内容无法解析成 JSON。原始内容开头：' + s.slice(0, 200));
  }

  let list = Array.isArray(obj) ? obj : obj.answers || obj.data || obj.result || obj.list || null;

  // 兼容 {"1":"A","2":"B"} 这种映射写法
  if (list && !Array.isArray(list) && typeof list === 'object') {
    list = Object.keys(list)
      .filter((k) => /^\d+$/.test(k))
      .map((k) => (typeof list[k] === 'object' ? { index: k, ...list[k] } : { index: k, answer: list[k] }));
  }
  if ((!list || !list.length) && obj && typeof obj === 'object' && !Array.isArray(obj)) {
    const keys = Object.keys(obj).filter((k) => /^\d+$/.test(k));
    if (keys.length) {
      list = keys.map((k) => (typeof obj[k] === 'object' ? { index: k, ...obj[k] } : { index: k, answer: obj[k] }));
    }
  }

  if (!Array.isArray(list) || !list.length) {
    throw new Error('模型返回里没有 answers 数组。原始内容开头：' + s.slice(0, 200));
  }

  return list.map((it, i) => {
    const o = typeof it === 'string' ? { answer: it } : it || {};
    const raw = o.answer ?? o.ans ?? o.value ?? o.result ?? o.fill ?? '';
    // 填空多空时模型可能返回数组，统一转成 ||| 分隔的字符串
    const answer = Array.isArray(raw)
      ? raw.map((x) => String(x).trim()).filter(Boolean).join('|||')
      : String(raw).trim();
    return {
      index: Number(o.index ?? o.id ?? o.no ?? o.question ?? i + 1) || i + 1,
      answer,
      reason: String(o.reason ?? o.explain ?? o.explanation ?? o.analysis ?? '').trim()
    };
  });
}

/* ---------------- 消息路由 ---------------- */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'QC_SOLVE') {
    (async () => {
      try {
        const { content, usage, model } = await callChat(msg.text, { timeout: 120000 });
        const answers = parseAnswers(content);
        sendResponse({ ok: true, answers, usage, model });
      } catch (e) {
        sendResponse({ ok: false, error: String(e && e.message || e) });
      }
    })();
    return true;
  }

  if (msg.type === 'QC_OPTIONS') {
    try {
      chrome.runtime.openOptionsPage();
      sendResponse({ ok: true });
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
    return true;
  }

  if (msg.type === 'QC_EXPLAIN') {
    (async () => {
      try {
        const r = await callChatPlain(msg.text, msg.system, 60000);
        sendResponse({ ok: true, text: r.content, usage: r.usage });
      } catch (e) {
        sendResponse({ ok: false, error: String(e && e.message || e) });
      }
    })();
    return true;
  }

  if (msg.type === 'QC_CODE') {
    (async () => {
      try {
        const r = await callChatPlain(msg.text, CODE_PROMPT, 120000);
        sendResponse({ ok: true, text: r.content, usage: r.usage });
      } catch (e) {
        sendResponse({ ok: false, error: String(e && e.message || e) });
      }
    })();
    return true;
  }

  /* 写进代码编辑器：Monaco 的 model 只存在于页面主世界，
     content script 在隔离环境里碰不到，只能从这儿注入进去。 */
  if (msg.type === 'QC_CODE_WRITE') {
    (async () => {
      try {
        const tabId = sender && sender.tab && sender.tab.id;
        if (!tabId) throw new Error('拿不到当前标签页');
        const results = await chrome.scripting.executeScript({
          target: { tabId, allFrames: false },
          world: 'MAIN',
          func: qcWriteCodeInPage,
          args: [String(msg.code || '')]
        });
        const r = results && results[0] && results[0].result;
        if (!r || !r.ok) throw new Error((r && r.note) || '页面里的编辑器没有接受写入');
        sendResponse({ ok: true, how: r.how, verified: !!r.verified });
      } catch (e) {
        sendResponse({ ok: false, error: String(e && e.message || e) });
      }
    })();
    return true;
  }

  if (msg.type === 'QC_TEST') {
    (async () => {
      try {
        const r = await callChat('第1题【单选】\n1+1 等于几？\nA. 1\nB. 2\nC. 3\nD. 4', { timeout: 45000 });
        const answers = parseAnswers(r.content);
        sendResponse({ ok: true, answers, model: r.model });
      } catch (e) {
        sendResponse({ ok: false, error: String(e && e.message || e) });
      }
    })();
    return true;
  }

  if (msg.type === 'QC_OPEN_PANEL') {
    const tabId = msg.tabId || sender?.tab?.id;
    if (tabId) {
      chrome.tabs.sendMessage(tabId, { type: 'QC_TOGGLE_PANEL' }).catch(() => {});
    }
  }
});

/* 快捷键：Alt+Q 开合面板；Alt+Shift+Q 一键解题 */
chrome.commands.onCommand.addListener(async (command) => {
  const map = {
    'toggle-panel': 'QC_TOGGLE_PANEL',
    'one-key-solve': 'QC_ONEKEY'
  };
  const type = map[command];
  if (!type) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type });
  } catch (e) {
    // 页面里没有 content script（比如 edge:// 内部页面），静默忽略
  }
});

/* 首次安装：打开说明页 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') }).catch(() => {});
  }
});

/* ============================================================
 * 注入到页面主世界执行的函数：把代码写进编辑器
 * 注意：这个函数会被序列化后送进页面，不能引用外部变量
 * ============================================================ */
function qcWriteCodeInPage(code) {
  const SEL = '.monaco-editor, .monaco-diff-editor, .cm-editor, .CodeMirror, .ace_editor';
  const text = String(code == null ? '' : code);

  const vis = (el) => {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 24 || r.height < 24) return false;
    const cs = window.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    return true;
  };

  const nodes = Array.prototype.slice.call(document.querySelectorAll(SEL)).filter(vis);
  if (!nodes.length) return { ok: false, note: '页面上没找到可见的代码编辑器' };
  nodes.sort((a, b) => b.offsetWidth * b.offsetHeight - a.offsetWidth * a.offsetHeight);
  const el = nodes[0];

  const norm = (s) => String(s || '').replace(/\s+/g, '');

  const readBack = () => {
    const box =
      el.querySelector('.view-lines') ||
      el.querySelector('.cm-content') ||
      el.querySelector('.CodeMirror-code') ||
      el.querySelector('.ace_text-layer') ||
      el;
    return String(box.innerText || box.textContent || '');
  };

  const done = (how) => {
    let got = '';
    try {
      got = norm(readBack());
    } catch (e) {}
    const want = norm(text);
    const verified = !!got && (got.indexOf(want.slice(0, 40)) >= 0 || want.indexOf(got.slice(0, 40)) >= 0);
    return { ok: true, how: how, verified: verified };
  };

  /* 1) Monaco：直接改 model，最稳 */
  try {
    const m = window.monaco;
    if (m && m.editor && m.editor.getEditors) {
      const dom = el.closest('.monaco-editor') || el;
      const eds = m.editor.getEditors() || [];
      for (let i = 0; i < eds.length; i++) {
        let node = null;
        try {
          node = eds[i].getDomNode();
        } catch (e) {
          node = null;
        }
        if (!node || !vis(node)) continue;
        if (node === dom || node.contains(dom) || dom.contains(node)) {
          eds[i].setValue(text);
          try {
            eds[i].focus();
          } catch (e) {}
          return done('monaco');
        }
      }
      // DOM 对不上：按语言挑一个 model，避开纯文本的「测试用例」编辑器
      try {
        const models = (m.editor.getModels && m.editor.getModels()) || [];
        const codeLang = /^(cpp|c\+\+|python|java|javascript|typescript|go|rust|c|cs|csharp|kotlin|swift|php|ruby)$/i;
        let target = null;
        for (let i = 0; i < models.length; i++) {
          const mo = models[i];
          if (mo && codeLang.test(String(mo.getLanguageId ? mo.getLanguageId() : ''))) target = mo;
        }
        if (target) {
          target.setValue(text);
          return done('monaco-model');
        }
      } catch (e) {}
    }
  } catch (e) {}

  /* 2) Ace */
  try {
    if (window.ace && window.ace.edit) {
      const box = el.closest('.ace_editor') || el;
      const ed = window.ace.edit(box);
      ed.setValue(text, -1);
      try {
        ed.clearSelection();
      } catch (e) {}
      return done('ace');
    }
  } catch (e) {}

  /* 3) CodeMirror 5：实例挂在 wrapper 上 */
  try {
    const wrap = el.closest('.CodeMirror') || el;
    if (wrap && wrap.CodeMirror && wrap.CodeMirror.setValue) {
      wrap.CodeMirror.setValue(text);
      return done('codemirror5');
    }
  } catch (e) {}

  /* 4) 可编辑区（CodeMirror 6 / 自研编辑器）：走真实输入，编辑器才会记账 */
  try {
    const content = el.querySelector('.cm-content') || (el.isContentEditable ? el : null);
    if (content) {
      content.focus();
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(content);
      sel.removeAllRanges();
      sel.addRange(range);
      let ok = false;
      try {
        ok = document.execCommand('insertText', false, text);
      } catch (e) {
        ok = false;
      }
      if (!ok) {
        const dt = new DataTransfer();
        dt.setData('text/plain', text);
        content.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
      }
      return done('editable');
    }
  } catch (e) {}

  /* 5) 兜底：往编辑器的隐藏 textarea 上派发粘贴 */
  try {
    const ta = el.querySelector('textarea.inputarea') || el.querySelector('textarea');
    if (ta) {
      ta.focus();
      ta.select();
      const dt = new DataTransfer();
      dt.setData('text/plain', text);
      const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
      ta.dispatchEvent(ev);
      if (!ev.defaultPrevented) document.execCommand('insertText', false, text);
      return done('paste');
    }
  } catch (e) {}

  return { ok: false, note: '这个编辑器不认自动写入，用「复制代码」手动粘贴' };
}

