/* 答题助手 QuizCopilot — popup / options */
(() => {
  const DEFAULTS = {
    provider: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: '',
    model: 'deepseek-chat',
    autoFill: true,
    autoPage: false,
    pageLimit: 30,
    showFab: true,
    selExplain: true,
    botSkin: 'blue'
  };

  const PRESETS = {
    deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
    dashscope: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
    moonshot: { baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
    zhipu: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
    siliconflow: { baseUrl: 'https://api.siliconflow.cn/v1', model: 'deepseek-ai/DeepSeek-V3' },
    openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    custom: { baseUrl: '', model: '' }
  };

  const $ = (id) => document.getElementById(id);

  function detectProvider(baseUrl) {
    const b = String(baseUrl || '').toLowerCase();
    if (!b) return 'deepseek';
    for (const [k, v] of Object.entries(PRESETS)) {
      if (k === 'custom') continue;
      if (v.baseUrl && b.startsWith(v.baseUrl.toLowerCase().replace(/\/v1$/, ''))) return k;
    }
    return 'custom';
  }

  function setStatus(text, kind) {
    const el = $('testStatus');
    el.textContent = text;
    el.className = 'status show ' + (kind || 'info');
  }

  function clearStatus() {
    const el = $('testStatus');
    el.className = 'status';
    el.textContent = '';
  }

  /* 以标签页打开时放宽布局 */
  function adaptLayout() {
    if (window.innerWidth > 500) {
      document.body.style.width = '100%';
      document.body.style.maxWidth = '560px';
      document.body.style.margin = '0 auto';
      document.body.style.minHeight = '100vh';
      document.body.style.boxShadow = '0 0 0 1px rgba(255,255,255,.05)';
    }
  }

  /* 版本号直接读 manifest，避免和打包版本脱节 */
  try {
    const ver = chrome.runtime.getManifest().version;
    $('verTag').textContent = 'QuizCopilot v' + ver;
  } catch (e) {}

  /* Edge 里 chrome://extensions 打不开，按浏览器给出正确地址 */
  try {
    const isEdge = /Edg\//.test(navigator.userAgent);
    const el = $('extUrl');
    if (el) el.textContent = isEdge ? 'edge://extensions' : 'chrome://extensions';
  } catch (e) {}

  /* ---------- 载入 ---------- */
  chrome.storage.sync.get(DEFAULTS, (cfg) => {
    $('apiKey').value = cfg.apiKey || '';
    $('baseUrl').value = cfg.baseUrl || DEFAULTS.baseUrl;
    $('model').value = cfg.model || DEFAULTS.model;
    $('provider').value = cfg.provider || detectProvider(cfg.baseUrl);
    $('swAuto').classList.toggle('on', !!cfg.autoFill);
    $('swPage').classList.toggle('on', !!cfg.autoPage);
    $('pageLimit').value = String(cfg.pageLimit || 30);
    $('swFab').classList.toggle('on', cfg.showFab !== false);
    $('swSel').classList.toggle('on', cfg.selExplain !== false);
    $('skin').value = cfg.botSkin || 'blue';
    adaptLayout();
  });

  /* ---------- 服务商切换 ---------- */
  $('provider').addEventListener('change', (e) => {
    const p = PRESETS[e.target.value];
    if (p && p.baseUrl) {
      $('baseUrl').value = p.baseUrl;
      $('model').value = p.model;
    }
    clearStatus();
  });

  /* ---------- 开关 ---------- */
  $('swAuto').addEventListener('click', () => {
    const on = $('swAuto').classList.toggle('on');
    // 不填就别翻页了，否则两个开关互相矛盾
    if (!on) $('swPage').classList.remove('on');
    chrome.storage.sync.set({ autoFill: on, autoPage: $('swPage').classList.contains('on') });
  });

  $('swPage').addEventListener('click', () => {
    const on = $('swPage').classList.toggle('on');
    // 连做必须写进页面，所以翻页一开就把自动填也带上
    if (on) $('swAuto').classList.add('on');
    chrome.storage.sync.set({ autoPage: on, autoFill: $('swAuto').classList.contains('on') });
  });

  $('pageLimit').addEventListener('change', (e) => {
    chrome.storage.sync.set({ pageLimit: Number(e.target.value) || 30 });
  });

  $('swFab').addEventListener('click', () => {
    const on = $('swFab').classList.toggle('on');
    chrome.storage.sync.set({ showFab: on });
  });

  $('swSel').addEventListener('click', () => {
    const on = $('swSel').classList.toggle('on');
    chrome.storage.sync.set({ selExplain: on });
  });

  $('skin').addEventListener('change', (e) => {
    chrome.storage.sync.set({ botSkin: e.target.value });
  });

  /* ---------- 保存 ---------- */
  $('save').addEventListener('click', () => {
    const apiKey = $('apiKey').value.trim();
    const baseUrl = $('baseUrl').value.trim();
    const model = $('model').value.trim();

    if (!baseUrl) return setStatus('Base URL 不能为空。', 'err');
    if (!model) return setStatus('模型名不能为空。', 'err');

    chrome.storage.sync.set(
      {
        provider: $('provider').value,
        apiKey,
        baseUrl,
        model,
        autoFill: $('swAuto').classList.contains('on'),
        autoPage: $('swPage').classList.contains('on'),
        pageLimit: Number($('pageLimit').value) || 30,
        showFab: $('swFab').classList.contains('on'),
        selExplain: $('swSel').classList.contains('on'),
        botSkin: $('skin').value
      },
      () => {
        if (chrome.runtime.lastError) {
          setStatus('保存失败：' + chrome.runtime.lastError.message, 'err');
          return;
        }
        setStatus(apiKey ? '已保存。到答题页面按 Alt+Q 或点悬浮按钮试试。' : '已保存，但还没填 API Key。', apiKey ? 'ok' : 'err');
      }
    );
  });

  /* ---------- 测试连接 ---------- */
  $('test').addEventListener('click', () => {
    const btn = $('test');
    const apiKey = $('apiKey').value.trim();
    if (!apiKey) return setStatus('先填 API Key 再测试。', 'err');

    btn.disabled = true;
    setStatus('正在连模型服务…', 'info');

    chrome.storage.sync.set(
      {
        provider: $('provider').value,
        apiKey,
        baseUrl: $('baseUrl').value.trim(),
        model: $('model').value.trim()
      },
      () => {
        chrome.runtime.sendMessage({ type: 'QC_TEST' }, (resp) => {
          btn.disabled = false;
          if (chrome.runtime.lastError) {
            setStatus('测试失败：' + chrome.runtime.lastError.message, 'err');
            return;
          }
          if (resp && resp.ok) {
            const a = (resp.answers && resp.answers[0]) || {};
            setStatus(`连接正常（${resp.model || '模型'}）。示例题答案：${a.answer || '—'}`, 'ok');
          } else {
            setStatus((resp && resp.error) || '测试失败，未知原因。', 'err');
          }
        });
      }
    );
  });

  /* ---------- 打开面板 ---------- */
  $('openPanel').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;
    if (/^(chrome|edge|about|chrome-extension):/i.test(tab.url || '')) {
      setStatus('浏览器内部页面（如设置页、新标签页）无法注入，请在答题网页上使用。', 'err');
      return;
    }
    chrome.tabs.sendMessage(tab.id, { type: 'QC_START' }, (resp) => {
      if (chrome.runtime.lastError) {
        setStatus('这个页面还没注入脚本。刷新一下页面（F5）再试。', 'err');
        return;
      }
      // 弹窗会自动关闭
    });
    setTimeout(() => window.close(), 300);
  });

  /* ---------- 一键解题 ---------- */
  $('oneKey').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;
    if (/^(chrome|edge|about|chrome-extension):/i.test(tab.url || '')) {
      setStatus('浏览器内部页面（如设置页、新标签页）无法注入，请在答题网页上使用。', 'err');
      return;
    }
    chrome.tabs.sendMessage(tab.id, { type: 'QC_ONEKEY' }, (resp) => {
      if (chrome.runtime.lastError) {
        setStatus('这个页面还没注入脚本。刷新一下页面（F5）再试。', 'err');
      }
    });
    setTimeout(() => window.close(), 300);
  });
})();
