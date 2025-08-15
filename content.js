(() => {
    if (window.__volBoostPlus?.ready) return;

    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    // --- Guarantee resume on first user interaction (one-time) ---
    function ensureResume() {
        if (ctx.state === 'suspended') ctx.resume();
    }
    ['pointerdown', 'keydown', 'touchstart'].forEach(t =>
        window.addEventListener(t, ensureResume, { once: true, capture: true, passive: true })
    );

    // Shared nodes
    const hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 120;
    hpf.Q.value = 0.707;
    const notch = ctx.createBiquadFilter();
    notch.type = 'notch';
    notch.frequency.value = 100;
    notch.Q.value = 4;
    const presence = ctx.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.value = 3000;
    presence.Q.value = 1.2;
    presence.gain.value = 3;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 18;
    comp.ratio.value = 2.5;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;

    const gainNode = ctx.createGain(); gainNode.gain.value = 2.0;

    let limiterNode = null;
    let wantComp = true;
    let ceilingDb = -1;

    const sources = new Map(); // el -> MediaElementSource

    async function ensureLimiter() {
        if (limiterNode) return limiterNode;
        try {
            await ctx.audioWorklet.addModule(chrome.runtime.getURL('limiter-worklet.js'));
            limiterNode = new AudioWorkletNode(ctx, 'peak-limiter', { processorOptions: { lookaheadMs: 5, ceilingDb } });
        } catch { limiterNode = null; }
        return limiterNode;
    }

    function chainNodes() {
        const arr = [hpf, notch, presence];
        if (wantComp) arr.push(comp);
        arr.push(gainNode);
        if (limiterNode) arr.push(limiterNode);
        return arr;
    }

    function connectSource(src) {
        try { src.disconnect(); } catch { }
        let prev = src;
        for (const n of chainNodes()) { prev.connect(n); prev = n; }
        prev.connect(ctx.destination);
    }

    function reconnectAll() {
        for (const src of sources.values()) connectSource(src);
    }

    function hook(el) {
        if (!(el instanceof HTMLMediaElement) || sources.has(el)) return;
        try {
            // mute element, route via WebAudio
            el.muted = true;
            const src = ctx.createMediaElementSource(el);
            sources.set(el, src);
            connectSource(src);
            el.addEventListener('play',
                () => {
                    if (ctx.state === 'suspended') ctx.resume();
                }, { passive: true });
        } catch {/* DRM/CORS cases: ignore */ }
    }

    document.querySelectorAll('audio,video').forEach(hook);
    const mo = new MutationObserver(ms => {
        for (const m of ms) {
            m.addedNodes.forEach(n => {
                if (n instanceof HTMLMediaElement) hook(n);
                else if (n.querySelectorAll) n.querySelectorAll('audio,video').forEach(hook);
            });
        }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });

    async function apply(s) {
        gainNode.gain.value = Math.max(0.0, Math.min(12.0, Number(s.gain) || 1.0));
        hpf.frequency.value = Math.max(20, Math.min(300, Number(s.hpf) || 120));
        notch.frequency.value = Math.max(50, Math.min(300, Number(s.notchHz) || 100));
        presence.gain.value = Math.max(0, Math.min(12, Number(s.presence) || 3));

        const useComp = !!s.comp;
        const newCeil = (typeof s.limiter === 'number') ? s.limiter : -1;

        let needReconnect = false;

        if (useComp !== wantComp) { wantComp = useComp; needReconnect = true; }

        if (!limiterNode) { await ensureLimiter(); if (limiterNode) needReconnect = true; }
        if (limiterNode && newCeil !== ceilingDb) {
            ceilingDb = newCeil;
            limiterNode.port.postMessage({ type: 'config', ceilingDb });
        }

        if (needReconnect) reconnectAll();

        if (ctx.state === 'suspended') ctx.resume();
    }

    const NEUTRAL = { gain: 1.0, hpf: 20, notchHz: 50, presence: 0, comp: false, limiter: -1 };
    function bypass() {
        apply(NEUTRAL); // keep chain connected; just neutral settings
        // touch all sources so newly added elements after reset also run neutral
        document.querySelectorAll('audio,video').forEach(hook);
    }

    chrome.runtime.onMessage.addListener((msg) => {
        if (msg?.type === 'APPLY') apply(msg.state);
        if (msg?.type === 'BYPASS' || msg?.type === 'RESET') bypass();
    });

    window.__volBoostPlus = { ready: true };
})();
