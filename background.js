// Session apply store (tabId -> state). Prefer chrome.storage.session if available.
const sess = chrome.storage.session || chrome.storage.local;
const SESSION_KEY = 'sessionStates';

// Helper
function originFromUrl(u) {
    try {
        return new URL(u).origin;
    } catch { return null; }
}

async function getSessionStates() {
    const obj = await sess.get(SESSION_KEY);
    return obj[SESSION_KEY] || {};
}
async function setSessionStates(map) {
    await sess.set({ [SESSION_KEY]: map });
}

// Messages from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    (async () => {
        if (msg?.type === 'SET_SESSION_APPLY' && typeof msg.tabId === 'number') {
            const map = await getSessionStates();
            map[msg.tabId] = msg.state;
            await setSessionStates(map);
            sendResponse({ ok: true });
            return;
        }
        if (msg?.type === 'CLEAR_SESSION_APPLY' && typeof msg.tabId === 'number') {
            const map = await getSessionStates();
            delete map[msg.tabId];
            await setSessionStates(map);
            sendResponse({ ok: true });
            return;
        }
    })();
    return true; // async
});

// Clean up when tab closes
chrome.tabs.onRemoved.addListener(async (tabId) => {
    const map = await getSessionStates();
    if (map[tabId]) {
        delete map[tabId];
        await setSessionStates(map);
    }
});

// Auto-apply logic (site-level and session-level)
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
    if (info.status !== 'complete' || !tab.url) return;
    const origin = originFromUrl(tab.url);
    if (!origin) return;

    const { siteStates = {} } = await chrome.storage.local.get('siteStates');
    const siteState = siteStates[origin];

    const map = await getSessionStates();
    const sessionState = map[tabId];

    const state = sessionState || siteState;
    if (!state) return;

    // Ensure permission for origin (needed after reload)
    const hasPerm = await chrome.permissions.contains({ origins: [origin + '/*'] });
    if (!hasPerm) {
        // We cannot prompt from background on page load; skip silently.
        return;
    }

    try {
        await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
        await chrome.tabs.sendMessage(tabId, { type: 'APPLY', state });
    } catch (_) {
        // restricted pages ignored
    }
});

chrome.commands.onCommand.addListener(async (cmd) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    if (cmd === 'booster-apply') chrome.runtime.sendMessage({ type: 'TRIGGER_POPUP_APPLY', tabId: tab.id });
    if (cmd === 'booster-reset') chrome.tabs.sendMessage(tab.id, { type: 'RESET' });
});
