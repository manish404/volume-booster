// ---------- DOM ----------
const els = {
    preset: document.getElementById('preset'),
    presetBtn: document.getElementById('presetBtn'),
    presetBtnText: document.getElementById('presetBtnText'),
    presetDropdown: document.getElementById('presetDropdown'),
    presetMenu: document.getElementById('presetMenu'),

    gain: document.getElementById('gain'), gOut: document.getElementById('gOut'), gBar: document.getElementById('gBar'),
    limiter: document.getElementById('limiter'), limOut: document.getElementById('limOut'),
    comp: document.getElementById('comp'),
    presence: document.getElementById('presence'), preOut: document.getElementById('preOut'),
    hpf: document.getElementById('hpf'), hpOut: document.getElementById('hpOut'),
    notchHz: document.getElementById('notchHz'), noOut: document.getElementById('noOut'),

    enableSite: document.getElementById('enableSite'),

    riskWrap: document.getElementById('riskWrap'), risk: document.getElementById('risk'),
    status: document.getElementById('status'), siteHost: document.getElementById('siteHost'),

    apply: document.getElementById('apply'), reset: document.getElementById('reset'),
};

// ---------- Defaults / presets ----------
const DEFAULTS = { gain: 2.0, limiter: -1.0, comp: true, presence: 3.0, hpf: 120, notchHz: 100, enableSite: false, preset: 'fan' };
const PRESETS = {
    dialogue: { gain: 1.8, limiter: -1.0, comp: true, presence: 4.0, hpf: 90, notchHz: 110 },
    fan: { gain: 2.2, limiter: -1.0, comp: true, presence: 2.5, hpf: 140, notchHz: 100 },
    cleanloud: { gain: 3.0, limiter: -0.5, comp: true, presence: 2.0, hpf: 100, notchHz: 90 },
    dialoguemax: { gain: 2.2, limiter: -1.0, comp: true, presence: 5.0, hpf: 110, notchHz: 110 },
    latenight: { gain: 2.6, limiter: -1.0, comp: true, presence: 2.0, hpf: 120, notchHz: 95 },
    basskeep: { gain: 2.0, limiter: -1.0, comp: true, presence: 1.5, hpf: 80, notchHz: 100 },
    streamboost: { gain: 2.8, limiter: -0.8, comp: true, presence: 3.0, hpf: 100, notchHz: 100 },
    none: null
};
const RESET_STATE = { preset: 'none', gain: 1.0, limiter: -1.0, comp: false, presence: 0, hpf: 20, notchHz: 50, enableSite: false };

// ---------- Utils ----------
const originFromUrl = u => { try { return new URL(u).origin; } catch { return null; } };
function presetName(id) {
    const map = {
        cleanloud: 'Loud & Clean',
        fan: 'Fan-Noise Cut',
        dialogue: 'Dialogue Boost',
        dialoguemax: 'Dialogue Max',
        latenight: 'Late Night',
        basskeep: 'Bass Keep',
        streamboost: 'Stream Boost',
        none: 'Custom'
    };
    return map[id] || 'Custom';
}
function uiToState() {
    return {
        preset: els.preset.value,
        gain: +els.gain.value, limiter: +els.limiter.value, comp: !!els.comp.checked,
        presence: +els.presence.value, hpf: +els.hpf.value, notchHz: +els.notchHz.value,
        enableSite: !!els.enableSite.checked
    };
}
function render(s) {
    // preset
    els.preset.value = s.preset || 'none';
    els.presetBtnText.textContent = presetName(els.preset.value);
    // ranges + outputs
    els.gain.value = s.gain; els.gOut.textContent = s.gain.toFixed(2) + 'x';
    els.gBar.style.width = ((s.gain - 0.5) / (6 - 0.5) * 100).toFixed(1) + '%';
    els.limiter.value = s.limiter; els.limOut.textContent = s.limiter.toFixed(1) + ' dB';
    els.comp.checked = !!s.comp;
    els.presence.value = s.presence; els.preOut.textContent = s.presence.toFixed(1) + ' dB';
    els.hpf.value = s.hpf; els.hpOut.textContent = s.hpf + ' Hz';
    els.notchHz.value = s.notchHz; els.noOut.textContent = s.notchHz + ' Hz';
    els.enableSite.checked = !!s.enableSite;
    showRisk(s);
}
function showRisk(s) {
    const msgs = [];
    if (s.gain >= 3.5) msgs.push('High boost can distort — keep Limiter ≤ -1 dB.');
    if (!s.comp && s.gain >= 2.6) msgs.push('Enable Compressor to avoid pumping.');
    if (s.limiter > -0.5 && s.gain >= 3.0) msgs.push('Set Limiter to -1 dB for clean peaks.');
    if (s.limiter > -1.0 && s.gain >= 2.5) msgs.push('Limiter ≥ -1 dB recommended at high boost.');
    if (s.presence >= 6) msgs.push('Presence ≥ 6 dB can sound harsh.');
    if (s.hpf > 180) msgs.push('High-pass above 180 Hz may thin voices.');

    const has = msgs.length > 0;
    els.risk.textContent = has ? ('⚠ ' + msgs[0]) : '';
    els.riskWrap.classList.toggle('dn', !has);
}

// ---------- storage ----------
const LS_KEY = 'boosterPlus.ui';
const loadLocal = () => {
    try {
        return JSON.parse(localStorage.getItem(LS_KEY)) || DEFAULTS;
    } catch { return DEFAULTS; }
};
const saveLocal = () => localStorage.setItem(LS_KEY, JSON.stringify(uiToState()));

// ---------- tooltips ----------
function placeTip(w) {
    const tip = w.querySelector('.tip');
    tip.textContent = w.getAttribute('data-tip') || '';
    const r = w.getBoundingClientRect();
    const vw = document.documentElement.clientWidth,
        vh = document.documentElement.clientHeight;
    const W = 320, H = (tip.getBoundingClientRect().height || 90);
    let x = r.left + r.width / 2 - W / 2;
    let y = r.top - 12 - H;
    if (x < 8) x = 8;
    if (x + W > vw - 8) x = vw - W - 8;
    if (y < 8) y = r.bottom + 10;
    tip.style.setProperty('--tx', x + 'px');
    tip.style.setProperty('--ty', y + 'px');
}
function bindTooltips() {
    document.querySelectorAll('.info').forEach(el => {
        if (el.__t) return; el.__t = true;
        el.addEventListener('mouseenter', () => { placeTip(el); el.classList.add('show'); });
        el.addEventListener('mouseleave', () => el.classList.remove('show'));
        el.addEventListener('mousemove', () => placeTip(el));
    });
}

// ---------- status ------------
(function statusAuto() {
    const s = document.getElementById('status'); if (!s) return;
    const classify = () => {
        const t = (s.textContent || '').trim().toLowerCase();
        s.removeAttribute('data-busy'); s.removeAttribute('data-kind');
        if (!t) return;
        if (t.endsWith('…') || /applying|resetting/.test(t)) s.setAttribute('data-busy', '1');
        else if (/applied|reset/.test(t)) s.setAttribute('data-kind', 'ok');
        else if (/cannot|unsupported|permission|could not/.test(t)) s.setAttribute('data-kind', 'warn');
        else if (/fail|error/.test(t)) s.setAttribute('data-kind', 'err');
    };
    new MutationObserver(classify).observe(s, { childList: true, characterData: true, subtree: true });
    classify();
})();

// ---------- preset menu (fixed + clamped) ----------
function placeMenu() {
    const b = els.presetBtn.getBoundingClientRect(),
        vw = document.documentElement.clientWidth,
        vh = document.documentElement.clientHeight;
    const mw = Math.min(320, vw - 16);
    const mh = Math.min(els.presetMenu.scrollHeight || 260, vh - 16);
    let x = Math.min(b.left, vw - mw - 8);
    x = Math.max(8, x);
    const yBelow = b.bottom + 6, yAbove = b.top - mh - 6;
    const y = (yBelow + mh <= vh - 8) ? yBelow : Math.max(8, yAbove);
    els.presetMenu.style.setProperty('--mx', x + 'px');
    els.presetMenu.style.setProperty('--my', y + 'px');
    els.presetMenu.style.width = mw + 'px';
}
function toggleMenu(open) {
    const will = (open === undefined) ? !els.presetMenu.classList.contains('open') : open;
    els.presetMenu.classList.toggle('open', will);
    els.presetBtn.setAttribute('aria-expanded', will ? 'true' : 'false');
    if (will) { placeMenu(); els.presetMenu.focus(); }
}
function setPreset(val) {
    els.preset.value = val; els.presetBtnText.textContent = presetName(val);
    els.presetMenu.querySelectorAll('li')
        .forEach(li => li.setAttribute('aria-selected', li.dataset.val === val ? 'true' : 'false'));
    toggleMenu(false);
    const p = PRESETS[val];
    const next = p ? { ...uiToState(), ...p, preset: val } : { ...uiToState(), preset: 'none' };
    render(next); saveLocal(); scheduleLiveApply();
}
function bindPresetMenu() {
    els.presetDropdown.addEventListener('click',
        (e) => { if (e.target.closest('#presetMenu')) return; toggleMenu(); });
    els.presetMenu.querySelectorAll('li')
        .forEach(li => li.dataset.val = li.getAttribute('data-val')); // ensure dataset
    els.presetMenu.addEventListener('click',
        (e) => { const li = e.target.closest('li'); if (!li) return; setPreset(li.dataset.val); });
    els.presetMenu.addEventListener('keydown', (e) => {
        const items = [...els.presetMenu.querySelectorAll('li')];
        let idx = items.findIndex(li => li.getAttribute('aria-selected') === 'true');
        if (e.key === 'Escape') {
            toggleMenu(false);
            e.preventDefault(); return;
        }
        if (e.key === 'ArrowDown') {
            idx = (idx + 1) % items.length;
            setPreset(items[idx].dataset.val); e.preventDefault();
        }
        if (e.key === 'ArrowUp') {
            idx = (idx - 1 + items.length) % items.length;
            setPreset(items[idx].dataset.val); e.preventDefault();
        }
        if (e.key === 'Enter' || e.key === ' ') {
            toggleMenu(false);
            e.preventDefault();
        }
    });
    document.addEventListener('click', (e) => { if (!els.presetDropdown.contains(e.target)) toggleMenu(false); });
    window.addEventListener('resize', () => { if (els.presetMenu.classList.contains('open')) placeMenu(); });
}

// ---------- chrome helpers ----------
async function getActive() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
}
function restricted(u) {
    if (!u) return 'no-url'; if (!/^https?:/i.test(u)) return 'unsupported';
    if (new URL(u).hostname === 'chrome.google.com') return 'webstore'; return null;
}
async function ensureOriginPermission(origin) {
    if (!origin) return false;
    const has = await chrome.permissions.contains({ origins: [origin + '/*'] });
    if (has) return true;
    try { return !!(await chrome.permissions.request({ origins: [origin + '/*'] })); } catch { return false; }
}
async function tryInject(tabId) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId, allFrames: true },   // catch players inside iframes
            files: ['content.js']
        });
        return { ok: true };
    } catch (e) {
        return { ok: false, reason: (e && e.message) ? e.message : String(e) };
    }
}

// ---------- load state ----------
async function loadState() {
    const tab = await getActive();
    const origin = originFromUrl(tab?.url || '');
    els.siteHost.textContent = origin ? new URL(origin).host : '';
    const local = loadLocal();
    const { siteStates = {} } = await chrome.storage.local.get('siteStates');
    const site = origin && siteStates[origin] ? siteStates[origin] : null;
    const state = site ? { ...DEFAULTS, ...local, ...site, enableSite: true } : { ...DEFAULTS, ...local };
    render(state);
    return { tabId: tab?.id, origin, url: tab?.url };
}

// ---------- live apply ----------
let liveTabId = null, liveTimer = 0;
function scheduleLiveApply() {
    if (!liveTabId) return;
    const s = uiToState();
    clearTimeout(liveTimer);
    liveTimer = setTimeout(async () => {
        try {
            await chrome.tabs.sendMessage(liveTabId, { type: 'APPLY', state: s });
        } catch { }
    }, 80);
}

// ---------- apply/reset ----------
async function handleApply() {
    els.status.textContent = 'Applying…';
    const { tabId, origin, url } = await loadState();
    const s = uiToState(); saveLocal();

    const { siteStates = {}, globalState = DEFAULTS } = await chrome.storage.local.get(['siteStates', 'globalState']);
    if (s.enableSite && origin) {
        siteStates[origin] = s;
        await ensureOriginPermission(origin);
    } else if (origin) { delete siteStates[origin]; }
    await chrome.storage.local.set({ siteStates, globalState: { ...globalState, ...s } });

    const r = restricted(url);
    if (r) {
        els.status.textContent = (r === 'webstore') ? 'Cannot run on Chrome Web Store.' : 'Unsupported page.';
        return;
    }

    let inj = await tryInject(tabId);
    if (!inj.ok) {
        const granted = await ensureOriginPermission(origin);
        if (granted) inj = await tryInject(tabId);
    }
    if (!inj.ok) {
        els.status.textContent = humanizeInjectError(inj.reason, origin);
        return;
    }

    try {
        await chrome.tabs.sendMessage(tabId, { type: 'APPLY', state: s });
        liveTabId = tabId;
        els.status.textContent = 'Applied';
        await chrome.runtime.sendMessage({ type: 'SET_SESSION_APPLY', tabId, state: s });
    } catch { els.status.textContent = 'Injected but failed to configure.'; }
}
function humanizeInjectError(msg, origin) {
    if (/Cannot access contents of url.*chrome/i.test(msg)) return 'Cannot run on browser pages (chrome://, Web Store).';
    if (/Cannot access contents of url.*pdf/i.test(msg)) return 'Cannot run on the built-in PDF viewer.';
    if (/permission|host permission|authorization/i.test(msg))
        return `Site access not granted for ${origin ? new URL(origin).host : 'this site'}. Click the puzzle-piece → Booster+ → “On this site”.`;
    if (/files .* not found|Error loading file/i.test(msg)) return 'content.js is missing or misnamed in the extension.';
    return 'Injection failed: ' + msg;
}

async function handleReset() {
    els.status.textContent = 'Resetting…';
    const { tabId, origin, url } = await loadState();
    const r = restricted(url); if (r) {
        els.status.textContent = 'Cannot reset on this page.';
        return;
    }
    let ok = await tryInject(tabId);
    if (!ok && await ensureOriginPermission(origin)) ok = await tryInject(tabId);
    if (!ok) { els.status.textContent = 'Could not inject to reset.'; return; }

    try {
        // Send a neutral APPLY (keeps routing; avoids spinner)
        const neutral = { preset: 'none', gain: 1.0, limiter: -1.0, comp: false, presence: 0, hpf: 20, notchHz: 50, enableSite: els.enableSite?.checked };
        await chrome.tabs.sendMessage(tabId, { type: 'APPLY', state: neutral });
        render(neutral); saveLocal();
        els.status.textContent = 'Reset';
        await chrome.runtime.sendMessage({ type: 'CLEAR_SESSION_APPLY', tabId });
    } catch { els.status.textContent = 'Reset failed.'; }
}

// ---------- events ----------
function wire() {
    ['gain', 'limiter', 'presence', 'hpf', 'notchHz', 'comp', 'enableSite'].forEach(id => {
        els[id].addEventListener('input', () => { render(uiToState()); saveLocal(); scheduleLiveApply(); });
        els[id].addEventListener('change', () => { render(uiToState()); saveLocal(); scheduleLiveApply(); });
    });
    els.apply.addEventListener('click', handleApply);
    els.reset.addEventListener('click', handleReset);
}

// ---------- init ----------
document.addEventListener('DOMContentLoaded', async () => {
    bindTooltips();
    bindPresetMenu();
    wire();
    await loadState();
});
chrome.runtime.onMessage.addListener((m) => {
    if (m?.type === 'TRIGGER_POPUP_APPLY') handleApply();
});