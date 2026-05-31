// ==UserScript==
// @name         DSLib — Shared utilities for Demonicscans automators
// @namespace    demonicscans-lib
// @version      1.3
// @description  Shared constants, utilities, CSS and API helpers for DS automator scripts
// @author       Niokhy
// ==/UserScript==
/**
 * DSLib — exposed as a global so any @require-ing script can use it.
 *
 * Usage in another script's header:
 *   // @require  file:///C:/path/to/ds-lib.js
 *   // @require  https://cdn.jsdelivr.net/gh/your-user/your-repo@1.3/ds-lib.js
 *
 * Then in the script body:
 *   const { SKILLS, getCookie, handleStaminaLogic, ... } = DSLib;
 *
 * v1.3 (mutualisation maximale) — ADDITIVE release :
 *   - Expose les URLs (USE_ITEM_URL, HP_POT_URL, INVENTORY_URL, PLAYER_STATS_URL, FORM_HEADERS)
 *     et useStaminaPotion qui manquaient au return.
 *   - Nouveaux helpers : formatDuration, formatClock, useItemByInvId, parseHpFromBattle.
 *   - Nouvelles APIs :
 *       • createSettingsManager   — load/save/migrate localStorage
 *       • createSessionStats      — compteurs de session persistants
 *       • createFloatingPanel     — panel flottant générique avec drag + minimize
 *       • createChallengeGuard    — gestion centralisée des challenges Cloudflare
 *       • createIntervalLoop      — boucle setInterval avec inFlight guard
 *       • createReloadGuard       — anti-boucle de reloads
 *       • createMonsterTable      — tableau de configuration des monstres (Wave + Dungeon)
 *       • renderStatsModal        — modal Session Statistics standardisé
 *       • wireTabs                — bind générique des `.ds-tab-btn[data-target]`
 *       • runSkillPlan            — exécute un plan d'attaque skill-par-skill
 *       • iframe.{create,waitForLoad,waitFor,simulateDrag}
 */
const DSLib = (() => {
    'use strict';
    /* ====================================================================
       VERSION
       Bump this string every time ds-lib.js changes in a breaking way.
       Scripts that declare a different REQUIRED_DSLIB_VERSION will
       refuse to start, forcing the user to update all scripts together.
    ==================================================================== */
    const VERSION = '1.3';
    /* ====================================================================
       CONSTANTS
    ==================================================================== */
    /** Skill definitions: id sent to the damage API + stamina cost. */
    const SKILLS = {
        SLASH:               { id:  0, cost:    1 },
        POWER_SLASH:         { id: -1, cost:   10 },
        HEROIC_SLASH:        { id: -2, cost:   50 },
        ULTIMATE_SLASH:      { id: -3, cost:  100 },
        LEGENDARY_SLASH:     { id: -4, cost:  200 },
        WORLD_BREAKER_SLASH: { id: -5, cost: 1000 }
    };
    /** Liste ordonnée des noms de skills, du moins cher au plus cher. */
    const SKILL_ORDER = ['SLASH','POWER_SLASH','HEROIC_SLASH','ULTIMATE_SLASH','LEGENDARY_SLASH','WORLD_BREAKER_SLASH'];
    /** Colors used to colorize the automation status text in the GUI. */
    const STATUS_COLORS = {
        STOPPED: '#f44336',
        RUNNING: '#4caf50',
        FIGHTING: '#2196f3',
        LOOTING: '#ffd700'
    };
    /** Border color + optional glow for loot item cards, keyed by tier name (uppercase). */
    const TIER_STYLES = {
        COMMON:    { border: '#777',    glow: 'none' },
        RARE:      { border: '#2196f3', glow: 'none' },
        EPIC:      { border: '#9c27b0', glow: 'none' },
        LEGENDARY: { border: '#ff9800', glow: '0 0 8px #ff9800' }
    };
    const BASE_URL         = 'https://demonicscans.org';
    const USE_ITEM_URL     = 'https://demonicscans.org/use_item.php';
    const HP_POT_URL       = 'https://demonicscans.org/user_heal_potion.php';
    const INVENTORY_URL    = 'https://demonicscans.org/inventory.php';
    const PLAYER_STATS_URL = 'https://demonicscans.org/active_wave.php?gate=3&wave=3';
    const FORM_HEADERS     = { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' };
    /* ====================================================================
       UTILITIES
    ==================================================================== */
    /** Read a cookie value by name. Returns null if absent. */
    function getCookie(name) {
        return document.cookie
            .split('; ')
            .find(row => row.startsWith(name + '='))
            ?.split('=')[1] ?? null;
    }
    /** Write a cookie (path=/). */
    function setCookie(name, value) {
        document.cookie = `${name}=${value}; path=/`;
    }
    /** Current time as HH:MM:SS string (24-hour). */
    function now() {
        return new Date().toLocaleTimeString('en-GB', { hour12: false });
    }
    /** Promise-based sleep. */
    const sleep = ms => new Promise(res => setTimeout(res, ms));
    /** Random integer in [min, max] (inclusive). */
    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    /** Encode a plain object as application/x-www-form-urlencoded body string. */
    function buildFormBody(paramsObj) {
        return new URLSearchParams(paramsObj).toString();
    }
    /**
     * POST a form-encoded request.
     * Returns a raw fetch Response (caller must await .text() / .json()).
     */
    function postForm(url, paramsObj) {
        return fetch(url, {
            method: 'POST',
            headers: FORM_HEADERS,
            body: buildFormBody(paramsObj),
            credentials: 'same-origin'
        });
    }
    /**
     * Parse a damage cap string that supports K / M / B suffixes.
     * Returns Infinity for "0" or any invalid value.
     *
     * Examples:
     *   "1.5M"  →  1_500_000
     *   "3B"    →  3_000_000_000
     *   "500K"  →  500_000
     *   "0"     →  Infinity
     */
    function parseDamageCap(raw) {
        const str = (raw || '0').trim().toUpperCase();
        if (!str || str === '0') return Infinity;
        const match = str.match(/^(\d+(?:\.\d+)?)\s*([KMB]?)$/);
        if (!match) return Infinity;
        const mult = { K: 1e3, M: 1e6, B: 1e9 }[match[2]] || 1;
        return Math.round(parseFloat(match[1]) * mult);
    }
    /**
     * Convertit une valeur en entier ≥ 0 (ou null si non fini).
     * Remplace les fonctions toNonNegativeInt locales dans Dungeon et Wave.
     *
     * @param  {*}       v  — valeur à convertir
     * @returns {number|null}
     */
    function toNonNeg(v) {
        const n = Number(v);
        if (!Number.isFinite(n)) return null;
        return Math.max(0, Math.floor(n));
    }
    /**
     * Rend un élément GUI draggable via son header (#gui-top ou #mini-header).
     * Restaure la position sauvegardée au chargement, et persiste à chaque mouseup.
     *
     * @param {HTMLElement} gui             — conteneur principal du GUI
     * @param {Function}    getPosition     — () => { left, top } | null
     * @param {Function}    onPositionSaved — ({ left, top }) => void  (appelé après mouseup)
     */
    function makeDraggable(gui, getPosition, onPositionSaved) {
        const pos = getPosition();
        if (pos && typeof pos.left === 'number' && typeof pos.top === 'number') {
            const maxX = Math.max(0, window.innerWidth  - 100);
            const maxY = Math.max(0, window.innerHeight - 50);
            gui.style.left   = Math.min(pos.left, maxX) + 'px';
            gui.style.top    = Math.min(pos.top,  maxY) + 'px';
            gui.style.right  = 'auto';
            gui.style.bottom = 'auto';
        }

        let offsetX = 0, offsetY = 0, dragging = false;

        document.addEventListener('mousedown', (e) => {
            if (e.target.closest('button, input, select, textarea, a, label')) return;
            const header = gui.querySelector('#gui-top, #mini-header');
            if (!header || !header.contains(e.target)) return;

            const rect = gui.getBoundingClientRect();
            offsetX  = e.clientX - rect.left;
            offsetY  = e.clientY - rect.top;
            dragging = true;

            gui.style.left   = rect.left + 'px';
            gui.style.top    = rect.top  + 'px';
            gui.style.right  = 'auto';
            gui.style.bottom = 'auto';
            document.body.style.cursor = 'grabbing';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            let x = e.clientX - offsetX;
            let y = e.clientY - offsetY;
            const maxX = Math.max(0, window.innerWidth  - gui.offsetWidth);
            const maxY = Math.max(0, window.innerHeight - gui.offsetHeight);
            gui.style.left = Math.max(0, Math.min(maxX, x)) + 'px';
            gui.style.top  = Math.max(0, Math.min(maxY, y)) + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (!dragging) return;
            dragging = false;
            document.body.style.cursor = '';
            const left = parseInt(gui.style.left, 10);
            const top  = parseInt(gui.style.top,  10);
            if (Number.isFinite(left) && Number.isFinite(top)) {
                onPositionSaved({ left, top });
            }
        });
    }
    /**
     * Crée un canal de log attaché à un élément DOM.
     * Retourne un objet { add, clear, render, getHistory, setHistory }.
     *
     * Compat v1.2 : createLogChannel(element, maxHistory:number)
     * Nouveau v1.3 : createLogChannel(element, { maxHistory, persistKey })
     *   Si persistKey est fourni, charge l'historique depuis sessionStorage[persistKey]
     *   au démarrage et le persiste à chaque add/clear.
     */
    function createLogChannel(element, optsOrMax = 80) {
        const opts = (typeof optsOrMax === 'object' && optsOrMax !== null)
            ? optsOrMax
            : { maxHistory: optsOrMax };
        const maxHistory = opts.maxHistory ?? 80;
        const persistKey = opts.persistKey || null;

        let _history = [];
        if (persistKey) {
            try {
                const raw = sessionStorage.getItem(persistKey);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) _history = parsed.slice(-maxHistory);
                }
            } catch (_) {}
        }
        const persist = () => {
            if (!persistKey) return;
            try { sessionStorage.setItem(persistKey, JSON.stringify(_history)); } catch (_) {}
        };
        const render = () => {
            if (!element) return;
            element.innerHTML = '';
            _history.forEach(txt => {
                const div = document.createElement('div');
                div.innerHTML = txt;
                div.style.borderBottom = '1px solid #333';
                div.style.padding      = '2px 0';
                element.appendChild(div);
            });
            element.scrollTop = element.scrollHeight;
        };
        if (persistKey) render();

        return {
            add(msg) {
                const fullMsg = `[${now()}] ${msg}`;
                console.log(fullMsg);
                _history.push(fullMsg);
                if (_history.length > maxHistory) _history.shift();
                persist();
                render();
            },
            clear()         { _history = []; persist(); render(); },
            render,
            getHistory()    { return _history; },
            setHistory(arr) { _history = arr; persist(); render(); }
        };
    }
    /* ====================================================================
       v1.2 — FONCTIONS MUTUALISÉES depuis Reminders
    ==================================================================== */
    /**
     * Formate un grand nombre avec suffixe K / M / B / T.
     * Ex : 1500000 → "1.50M",  950 → "950"
     */
    function formatBigNumber(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return '0';
        const abs = Math.abs(n);
        if (abs >= 1e12) return (n / 1e12).toFixed(2) + 'T';
        if (abs >= 1e9)  return (n / 1e9).toFixed(2)  + 'B';
        if (abs >= 1e6)  return (n / 1e6).toFixed(2)  + 'M';
        if (abs >= 1e3)  return (n / 1e3).toFixed(2)  + 'K';
        return String(Math.round(n));
    }
    /**
     * Formate une durée en secondes en "Xh Ym Zs" / "Ym Zs" / "Zs".
     * Utile pour les timers (Reminders, Dungeon Shadow/PVP).
     */
    function formatDuration(seconds) {
        const s = Math.max(0, Math.floor(Number(seconds) || 0));
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        if (h > 0) return `${h}h ${m}m ${sec}s`;
        if (m > 0) return `${m}m ${sec}s`;
        return `${sec}s`;
    }
    /** Formate une Date en HH:MM (24h). */
    function formatClock(date) {
        const d = date instanceof Date ? date : new Date(date || Date.now());
        if (Number.isNaN(d.getTime())) return '--:--';
        return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    /** Échappe les caractères HTML spéciaux d'une chaîne. */
    function escapeHtml(text) {
        return String(text).replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }
    /** Alias de escapeHtml — pour les valeurs d'attributs HTML. */
    function escapeAttr(text) { return escapeHtml(text); }
    /**
     * Détecte si un document est une page de challenge Cloudflare
     * (anti-bot "Just a moment…" / "Attention Required").
     */
    function isChallengeDocument(doc) {
        if (!doc) return false;
        const title    = (doc.title                          || '').toLowerCase();
        const bodyText = (doc.body?.textContent              || '').toLowerCase();
        const html     = (doc.documentElement?.innerHTML     || '').toLowerCase();
        if (title.includes('just a moment') || title.includes('attention required')) return true;
        if (bodyText.includes('checking your browser before accessing'))             return true;
        if (bodyText.includes('verify you are human'))                               return true;
        if (html.includes('/cdn-cgi/challenge-platform/'))                           return true;
        if (doc.querySelector('form#challenge-form, #cf-challenge-running, .cf-browser-verification')) return true;
        return false;
    }
    /* ====================================================================
       CSS INJECTION
       Call injectBaseCSS() once at script startup to inject all shared
       modal / table / loot-grid classes into the page <head>.
    ==================================================================== */
    function injectBaseCSS() {
        const style = document.createElement('style');
        style.innerHTML = `
            /* ---- Modals ---- */
            .ds-modal-header { padding:15px 20px; background:#222; border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center; }
            .ds-modal-body   { padding:20px; }
            .ds-modal-section{ margin-bottom:15px; border-bottom:1px solid #333; padding-bottom:10px; }
            .ds-modal-title  { margin-top:0; font-size:15px; color:#2196f3; margin-bottom:10px; }
            .ds-input-group  { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
            .ds-input-group label { font-size:13px; color:#ccc; }
            .ds-input-group input[type="text"] { width:120px; padding:4px; border-radius:4px; border:1px solid #555; background:#222; color:white; text-align:right; font-family:monospace; }
            .ds-chk-label    { display:flex; align-items:center; cursor:pointer; margin-bottom:5px; color:#ccc; font-size:13px; }
            /* ---- Layout helpers ---- */
            .ds-grid-2       { display:grid; grid-template-columns:1fr 1fr; gap:15px; }
            .ds-box          { background:#151515; padding:15px; border-radius:6px; border:1px solid #333; }
            .ds-box-title    { margin:0 0 12px 0; color:#4caf50; font-size:13px; border-bottom:1px solid #333; padding-bottom:5px; text-transform:uppercase; letter-spacing:0.5px; }
            /* ---- Tabs ---- */
            .ds-tabs         { display:flex; background:#111; border-bottom:1px solid #333; }
            .ds-tab-btn      { flex:1; padding:12px; background:none; border:none; color:#777; cursor:pointer; font-weight:bold; border-bottom:2px solid transparent; transition:0.2s; }
            .ds-tab-btn:hover{ background:#222; color:#ccc; }
            .ds-tab-btn.active { color:#2196f3; border-bottom:2px solid #2196f3; background:#1e1e1e; }
            .ds-tab-content  { display:none; }
            .ds-tab-content.active { display:block; }
            /* ---- Monster table ---- */
            .ds-mon-table    { width:100%; border-collapse:collapse; font-size:12px; }
            .ds-mon-table th { text-align:left; color:#888; padding:6px 5px; border-bottom:1px solid #444; background:#111; position:sticky; top:0; z-index:1; }
            .ds-mon-table td { padding:5px; border-bottom:1px solid #2a2a2a; vertical-align:middle; }
            .ds-mon-table tr:hover td { background:#1a1a1a; }
            .ds-mon-input    { background:#222; border:1px solid #444; color:#fff; padding:3px 5px; font-family:monospace; font-size:12px; width:100%; box-sizing:border-box; border-radius:3px; }
            .ds-mon-select   { background:#222; border:1px solid #444; color:#fff; padding:3px 4px; font-size:11px; width:100%; border-radius:3px; }
            /* ---- Strategy table ---- */
            .ds-strat-table  { width:100%; border-collapse:collapse; font-size:12px; }
            .ds-strat-table th { text-align:left; color:#888; padding:5px; border-bottom:1px solid #444; }
            .ds-strat-table td { padding:5px; border-bottom:1px solid #333; }
            .ds-strat-input  { width:95%; background:#222; border:1px solid #444; color:#fff; padding:4px; font-family:monospace; }
            .ds-btn-remove   { color:#f44336; cursor:pointer; font-weight:bold; border:none; background:none; }
            /* ---- Session stats header ---- */
            .ds-stat-header  { display:flex; justify-content:space-around; align-items:center; padding-bottom:15px; border-bottom:1px solid #444; text-align:center; }
            .ds-stat-box     { flex:1; }
            .ds-stat-num     { font-size:28px; font-weight:bold; }
            .ds-stat-lbl     { font-size:12px; color:#aaa; text-transform:uppercase; letter-spacing:1px; }
            /* ---- Loot grid ---- */
            .ds-loot-grid    { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:12px; margin-top:15px; min-height:250px; max-height:500px; overflow-y:auto; overflow-x:hidden; padding:5px; box-sizing:border-box; }
            .ds-item-card    { position:relative; width:100%; aspect-ratio:1; background:#222; border-radius:6px; border:2px solid #444; cursor:help; transition:transform 0.1s; box-sizing:border-box; }
            .ds-item-card:hover { transform:scale(1.05); z-index:10; }
            .ds-item-img     { width:100%; height:100%; object-fit:cover; border-radius:4px; display:block; }
            .ds-item-count   { position:absolute; bottom:2px; right:2px; background:rgba(0,0,0,0.85); color:#fff; font-size:10px; padding:1px 4px; border-radius:4px; pointer-events:none; font-weight:bold; }
            .ds-empty-loot   { grid-column:1/-1; text-align:center; color:#666; font-style:italic; padding:20px 0; }
            /* ---- Textarea list area ---- */
            .ds-list-area    { width:100%; height:150px; background:#222; border:1px solid #444; color:#fff; font-family:monospace; padding:8px; box-sizing:border-box; resize:vertical; }
        `;
        document.head.appendChild(style);
    }
    /* ====================================================================
       PLAYER STATS PARSING
    ==================================================================== */
    function extractPlayerStatsFromDoc(doc) {
        let hp = null;
        const hpEl = doc.querySelector('.playerhp .muted')
                  || doc.querySelector('.player-resources .res-row .res-meta');
        if (hpEl) {
            const val = parseInt(hpEl.textContent.trim().split('/')[0].replace(/,/g, ''), 10);
            if (!Number.isNaN(val)) hp = val;
        }
        let stamina = null;
        const stamEl = doc.getElementById('stamina_span');
        if (stamEl) {
            const val = parseInt(stamEl.textContent.trim().replace(/,/g, ''), 10);
            if (!Number.isNaN(val)) stamina = val;
        }
        let exp = null;
        const expSpans = doc.querySelectorAll('.gtb-exp-top span');
        if (expSpans.length >= 2) {
            const parts = expSpans[expSpans.length - 1].textContent.trim().split('/');
            if (parts.length === 2) {
                const current = parseInt(parts[0].replace(/,/g, ''), 10);
                const max     = parseInt(parts[1].replace(/,/g, ''), 10);
                if (!Number.isNaN(current) && !Number.isNaN(max) && max !== 0) {
                    exp = { current, max, ratio: current / max };
                }
            }
        }
        return { hp, stamina, exp };
    }
    async function getPlayerStatsFromWave() {
        try {
            const response = await fetch(PLAYER_STATS_URL, { credentials: 'same-origin' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return extractPlayerStatsFromDoc(
                new DOMParser().parseFromString(await response.text(), 'text/html')
            );
        } catch (err) {
            console.error('[DSLib] Stats fetch failed', err);
            return null;
        }
    }
    /**
     * Parse l'HP courant depuis la réponse texte d'une page battle.
     * Cherche d'abord la classe .playerhp .muted, fallback sur regex "HP : N / N".
     * Retourne le HP courant (number) ou null.
     */
    function parseHpFromBattle(text) {
        if (typeof text !== 'string') return null;
        try {
            const doc = new DOMParser().parseFromString(text, 'text/html');
            const stats = extractPlayerStatsFromDoc(doc);
            if (typeof stats.hp === 'number') return stats.hp;
        } catch (_) {}
        const m = text.match(/HP\s*:?\s*([\d,]+)\s*\/\s*([\d,]+)/i);
        if (m) {
            const n = parseInt(m[1].replace(/,/g, ''), 10);
            if (Number.isFinite(n)) return n;
        }
        return null;
    }
    /* ====================================================================
       INVENTORY ID AUTO-FETCHER
    ==================================================================== */
    const POTION_NAMES = new Set([
        'Full Stamina Potion',
        'Large Stamina Potion',
        'Full Hp Potion',
        'Small Stamina Potion',
        // Mana potions (Wave Automator v11+)
        'Full Mana Potion',
        'Large Mana Potion',
        'Small Mana Potion'
    ]);
    async function fetchInventoryIds({ onUpdate, logFn = console.log, extraNames } = {}) {
        const names = extraNames ? new Set([...POTION_NAMES, ...extraNames]) : POTION_NAMES;
        try {
            const response = await fetch(INVENTORY_URL, { credentials: 'same-origin' });
            if (!response.ok) return;
            const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
            let anyUpdated = false;
            doc.querySelectorAll('.potion-card').forEach(card => {
                const nameNode = card.querySelector('.potion-name span');
                if (!nameNode) return;
                const rawName = nameNode.textContent.trim();
                if (!names.has(rawName)) return;
                const invId = parseInt(card.dataset.invId, 10);
                if (!invId || Number.isNaN(invId)) return;
                if (onUpdate(rawName, invId)) anyUpdated = true;
            });
            if (anyUpdated) logFn('🎒 Auto-updated Potion IDs from Inventory.');
        } catch (e) {
            logFn('⚠️ Failed to auto-fetch inventory IDs.');
        }
    }
    /* ====================================================================
       POTION / ITEM USAGE
    ==================================================================== */
    /**
     * Use any item by its inventory id (générique).
     * Renvoie true si "Item not found" n'apparaît PAS dans la réponse.
     */
    async function useItemByInvId(invId, label, { enableCalls = true, logFn = console.log } = {}) {
        if (!enableCalls) {
            logFn(`[SIMULATION] Used ${label} (invId: ${invId})`);
            return true;
        }
        try {
            const response = await postForm(USE_ITEM_URL, { inv_id: invId });
            const text = await response.text();
            if (text.includes('Item not found or not usable')) return false;
            return true;
        } catch (err) {
            logFn(`⚠️ ${label} request failed`);
            return false;
        }
    }
    /** Alias rétro-compat. */
    const useStaminaPotion = useItemByInvId;
    async function refillHp({ hpPotionId, enableHpPotion = true, enableCalls = true, logFn = console.log } = {}) {
        if (!enableHpPotion) { logFn('⏭️ HP Potion disabled in settings. Skipping heal.'); return; }
        if (!enableCalls)    { logFn('🚑 [SIMULATION] Using HP potion'); return; }
        logFn('🚑 Using HP potion…');
        try {
            await postForm(HP_POT_URL, { inv_id: hpPotionId });
        } catch (err) {
            logFn('⚠️ HP potion request failed');
        }
    }
    /* ====================================================================
       STAMINA REFILL LOGIC
    ==================================================================== */
    async function handleStaminaLogic(ctx) {
        const {
            enableCalls           = true,
            expThreshold          = 0.7,
            maxStaminaRefills     = 0,
            staminaThreshold      = 30,
            sspMinThreshold       = 0,
            maxSspRefills         = 0,
            sspFillGap            = false,
            enableSsp             = false,
            useLargeStamina       = false,
            useFullStamina        = false,
            smallStaminaPotionId  = 0,
            largeStaminaPotionId  = 0,
            fullStaminaPotionId   = 0,
            running               = true,
            currentExpRatio       = 0,
            logFn                 = console.log,
            persistStatsFn        = () => {}
        } = ctx;
        let currentStamina       = ctx.currentStamina       ?? 0;
        let staminaRefillsUsed   = ctx.staminaRefillsUsed   ?? 0;
        let sspRefillsUsed       = ctx.sspRefillsUsed       ?? 0;
        let largePotionsDepleted = ctx.largePotionsDepleted ?? false;
        const ret = () => ({ success, currentStamina, staminaRefillsUsed, sspRefillsUsed, largePotionsDepleted });
        let success = false;
        if (currentExpRatio >= expThreshold) {
            logFn(`📉 EXP Threshold reached (${(currentExpRatio * 100).toFixed(1)}%). Stopping refills.`);
            return ret();
        }
        if (staminaRefillsUsed >= maxStaminaRefills) {
            logFn(`🛑 Max refills reached (${staminaRefillsUsed}/${maxStaminaRefills}). Stopping refills.`);
            return ret();
        }
        if (!useLargeStamina && !useFullStamina && !enableSsp && !sspFillGap) {
            logFn('🛑 No stamina potion type enabled. Stopping refills.');
            return ret();
        }
        const opts = { enableCalls, logFn };
        if (!success && sspFillGap && sspRefillsUsed < maxSspRefills && smallStaminaPotionId) {
            if (currentStamina > sspMinThreshold) {
                logFn(`🧪 SSP gap-fill: stamina ${currentStamina} > min ${sspMinThreshold}. Filling toward ${staminaThreshold}…`);
                while (currentStamina < staminaThreshold && sspRefillsUsed < maxSspRefills && running) {
                    const ok = await useItemByInvId(smallStaminaPotionId, 'Small Stamina Potion', opts);
                    if (!ok) { logFn('⚠️ Out of Small Stamina Potions.'); break; }
                    sspRefillsUsed++;
                    currentStamina += 20;
                    persistStatsFn();
                    logFn(`⚡ SSP used (${sspRefillsUsed}/${maxSspRefills}). Stamina ~${currentStamina}.`);
                }
                success = currentStamina >= staminaThreshold;
            } else {
                logFn(`⏭️ SSP gap-fill skipped: stamina ${currentStamina} ≤ min ${sspMinThreshold}. Trying LSP/FSP.`);
            }
        }
        let lspFspUsed = false;
        if (!success && useLargeStamina && !largePotionsDepleted) {
            logFn('🧪 Consuming Large Stamina Potion…');
            success = await useItemByInvId(largeStaminaPotionId, 'Large Stamina Potion', opts);
            if (!success) {
                logFn('⚠️ Out of Large Stamina Potions. Marking as depleted.');
                largePotionsDepleted = true;
            } else {
                lspFspUsed = true;
            }
        }
        if (!success && useFullStamina) {
            logFn('🧪 Consuming Full Stamina Potion…');
            success = await useItemByInvId(fullStaminaPotionId, 'Full Stamina Potion', opts);
            if (success) lspFspUsed = true;
        }
        if (!success && enableSsp && sspRefillsUsed < maxSspRefills && smallStaminaPotionId) {
            logFn('🧪 Consuming Small Stamina Potion…');
            const ok = await useItemByInvId(smallStaminaPotionId, 'Small Stamina Potion', opts);
            if (ok) {
                sspRefillsUsed++;
                persistStatsFn();
                logFn(`🧪 SSP used. Total: ${sspRefillsUsed}/${maxSspRefills}`);
                success = true;
            }
        }
        if (success) {
            if (lspFspUsed) {
                staminaRefillsUsed++;
                persistStatsFn();
                logFn(`⚡ Stamina Refilled. Total LSP/FSP used: ${staminaRefillsUsed}/${maxStaminaRefills}`);
            }
        } else {
            logFn('⚠️ No usable Stamina Potions found.');
        }
        return ret();
    }
    /* ====================================================================
       LOOT TRACKING
    ==================================================================== */
    function processLootItems(items, lootTracker) {
        if (!items || !Array.isArray(items)) return;
        items.forEach(item => {
            if (!item) return;
            const id = item.id || item.inv_id || item.item_id;
            if (!id) return;
            if (!lootTracker[id]) {
                lootTracker[id] = {
                    count: 0,
                    img:   item.img   || item.image || '',
                    name:  item.name  || '',
                    tier:  (item.tier || 'COMMON').toUpperCase()
                };
            }
            lootTracker[id].count += (item.quantity || item.count || 1);
        });
    }
    /* ====================================================================
       LOOT GRID HTML BUILDER
    ==================================================================== */
    function buildLootGridHTML(lootTracker, baseUrl) {
        const items = Object.entries(lootTracker);
        if (items.length === 0) return '<div class="ds-empty-loot">No items looted this session yet.</div>';
        return items.map(([id, data]) => {
            const tier   = (data.tier || 'COMMON').toUpperCase();
            const style  = TIER_STYLES[tier] || TIER_STYLES.COMMON;
            const imgSrc = data.img
                ? (data.img.startsWith('http') ? data.img : `${baseUrl}/${data.img.replace(/^\//, '')}`)
                : '';
            const tooltip = `${data.name || id} ×${data.count}${tier !== 'COMMON' ? ' [' + tier + ']' : ''}`;
            return `<div class="ds-item-card" style="border-color:${style.border}; box-shadow:${style.glow};" title="${escapeAttr(tooltip)}">
            ${imgSrc ? `<img class="ds-item-img" src="${escapeAttr(imgSrc)}" alt="${escapeAttr(data.name || '')}">` : ''}
            <span class="ds-item-count">×${data.count}</span>
        </div>`;
        }).join('');
    }

    /* ====================================================================
       v1.3 — SETTINGS MANAGER
    ==================================================================== */
    function createSettingsManager({ storageKey, defaults, migrations = [], normalize } = {}) {
        if (!storageKey) throw new Error('[DSLib] createSettingsManager: storageKey required');
        const computeDefaults = () => (typeof defaults === 'function' ? defaults() : (defaults || {}));

        const _load = () => {
            const d = computeDefaults();
            let raw;
            try {
                const stored = localStorage.getItem(storageKey);
                raw = stored ? JSON.parse(stored) : { ...d };
            } catch (_) {
                raw = { ...d };
            }
            for (const mig of migrations) {
                try { raw = mig(raw, d) || raw; }
                catch (e) { console.warn(`[DSLib] settings migration error (${storageKey})`, e); }
            }
            if (typeof normalize === 'function') {
                try { raw = normalize(raw, d) || raw; }
                catch (e) { console.warn(`[DSLib] settings normalize error (${storageKey})`, e); }
            }
            return raw;
        };

        let _settings = _load();
        const persist = () => {
            try { localStorage.setItem(storageKey, JSON.stringify(_settings)); }
            catch (e) { console.warn(`[DSLib] settings persist failed (${storageKey})`, e); }
        };

        return {
            get()              { return _settings; },
            getField(key)      { return _settings ? _settings[key] : undefined; },
            set(partial)       { _settings = { ..._settings, ...(partial || {}) }; persist(); return _settings; },
            setField(key, val) { _settings[key] = val; persist(); return val; },
            reload()           { _settings = _load(); return _settings; },
            reset()            { _settings = computeDefaults(); persist(); return _settings; },
            persist,
            raw()              { return _settings; }
        };
    }

    /* ====================================================================
       v1.3 — SESSION STATS
    ==================================================================== */
    function createSessionStats({ storageKey, counters = [], structures = {} } = {}) {
        if (!storageKey) throw new Error('[DSLib] createSessionStats: storageKey required');
        const buildEmpty = () => {
            const base = {};
            counters.forEach(k => { base[k] = 0; });
            Object.entries(structures).forEach(([k, defaultVal]) => {
                base[k] = (defaultVal && typeof defaultVal === 'object' && !Array.isArray(defaultVal))
                    ? { ...defaultVal }
                    : (Array.isArray(defaultVal) ? [...defaultVal] : defaultVal);
            });
            return base;
        };

        const _hydrate = () => {
            const base = buildEmpty();
            try {
                const raw = sessionStorage.getItem(storageKey);
                if (!raw) return base;
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    counters.forEach(k => {
                        const n = Number(parsed[k]);
                        base[k] = Number.isFinite(n) ? n : 0;
                    });
                    Object.keys(structures).forEach(k => {
                        if (parsed[k] !== undefined) base[k] = parsed[k];
                    });
                }
            } catch (_) {}
            return base;
        };

        let _state = _hydrate();
        const persist = () => {
            try { sessionStorage.setItem(storageKey, JSON.stringify(_state)); } catch (_) {}
        };

        return {
            get(field)         { return _state[field]; },
            set(field, value)  { _state[field] = value; persist(); return value; },
            inc(field, n = 1)  { _state[field] = (Number(_state[field]) || 0) + n; persist(); return _state[field]; },
            all()              { return _state; },
            reset()            { _state = buildEmpty(); persist(); return _state; },
            hydrate()          { _state = _hydrate(); return _state; },
            persist,
            raw()              { return _state; }
        };
    }

    /* ====================================================================
       v1.3 — FLOATING PANEL (GUI shell)
    ==================================================================== */
    function createFloatingPanel({
        id,
        width = 700,
        position = { right: '15px', bottom: '70px' },
        baseStyle = '',
        getPosition,
        onPositionSaved,
        minimized = false,
        onMinimizedChange,
        render,
    } = {}) {
        if (!id) throw new Error('[DSLib] createFloatingPanel: id required');
        if (typeof render !== 'function') throw new Error('[DSLib] createFloatingPanel: render(fn) required');

        const el = document.createElement('div');
        el.id = id;
        const pos = position || {};
        el.style.cssText = `
            position:fixed;
            ${pos.left   != null ? `left:${pos.left};`     : ''}
            ${pos.right  != null ? `right:${pos.right};`   : ''}
            ${pos.top    != null ? `top:${pos.top};`       : ''}
            ${pos.bottom != null ? `bottom:${pos.bottom};` : ''}
            width:${typeof width === 'number' ? width + 'px' : width};
            background:rgba(30,30,30,0.95);
            color:white;
            font-family:sans-serif;
            border:1px solid #444;
            border-radius:1.5em;
            z-index:9999;
            box-shadow:0 4px 16px rgba(0,0,0,0.5);
            overflow:hidden;
            ${baseStyle}
        `;
        document.body.appendChild(el);

        let _minimized = !!minimized;
        const doRender = () => render(el, _minimized);
        doRender();

        if (typeof getPosition === 'function' && typeof onPositionSaved === 'function') {
            makeDraggable(el, getPosition, onPositionSaved);
        }

        return {
            el,
            refresh:        () => doRender(),
            isMinimized:    () => _minimized,
            setMinimized:   (val) => {
                _minimized = !!val;
                if (typeof onMinimizedChange === 'function') onMinimizedChange(_minimized);
                doRender();
            },
            destroy:        () => { try { el.remove(); } catch (_) {} },
        };
    }

    /* ====================================================================
       v1.3 — CHALLENGE GUARD (Cloudflare)
    ==================================================================== */
    function createChallengeGuard({
        pollMs   = 2500,
        timeoutMs = 120000,
        isChallenge = () => isChallengeDocument(document),
        onClear  = () => {},
        onTimeout = () => {},
        logFn    = console.log,
    } = {}) {
        let _timerId  = null;
        let _startAt  = 0;
        const _active = () => _timerId !== null;

        function tick() {
            if (Date.now() - _startAt >= timeoutMs) {
                stop();
                logFn('⏱️ Challenge wait timed out.');
                try { onTimeout('timeout'); } catch (_) {}
                return;
            }
            if (!isChallenge()) {
                stop();
                logFn('✅ Challenge cleared — resuming.');
                try { onClear(); } catch (_) {}
                return;
            }
        }

        function schedule(reason) {
            if (_active()) return;
            _startAt = Date.now();
            logFn(`🛡️ Cloudflare challenge detected${reason ? ` (${reason})` : ''}. Waiting…`);
            _timerId = setInterval(tick, pollMs);
        }
        function stop() {
            if (_timerId !== null) {
                clearInterval(_timerId);
                _timerId = null;
            }
        }
        return { schedule, stop, isActive: _active };
    }

    /* ====================================================================
       v1.3 — INTERVAL LOOP
    ==================================================================== */
    function createIntervalLoop({
        intervalMs,
        tick,
        label = 'loop',
        runImmediately = true,
        inFlightGuard = true,
        logFn = console.log,
    } = {}) {
        if (typeof tick !== 'function') throw new Error('[DSLib] createIntervalLoop: tick(fn) required');
        const getInterval = () => (typeof intervalMs === 'function' ? intervalMs() : intervalMs);

        let _timerId = null;
        let _inFlight = false;
        let _lastTickAt = 0;
        let _currentInterval = getInterval();

        async function safeTick() {
            if (inFlightGuard && _inFlight) return;
            _inFlight = true;
            _lastTickAt = Date.now();
            try { await tick(); }
            catch (e) { logFn(`⚠️ [${label}] tick error: ${e.message || e}`); }
            finally { _inFlight = false; }
        }

        function start() {
            if (_timerId !== null) return;
            _currentInterval = getInterval();
            if (runImmediately) safeTick();
            _timerId = setInterval(safeTick, _currentInterval);
        }
        function stop() {
            if (_timerId !== null) { clearInterval(_timerId); _timerId = null; }
        }
        function restart(newIntervalMs) {
            stop();
            if (newIntervalMs != null) {
                if (typeof intervalMs === 'function') {
                    _currentInterval = newIntervalMs;
                } else {
                    intervalMs = newIntervalMs;
                    _currentInterval = newIntervalMs;
                }
            }
            start();
        }
        return {
            start, stop, restart,
            isRunning:   () => _timerId !== null,
            isInFlight:  () => _inFlight,
            lastTickAt:  () => _lastTickAt,
            currentInterval: () => _currentInterval,
        };
    }

    /* ====================================================================
       v1.3 — RELOAD GUARD
    ==================================================================== */
    function createReloadGuard({ storageKey, maxReloads = 3, windowMs = 120000 } = {}) {
        if (!storageKey) throw new Error('[DSLib] createReloadGuard: storageKey required');

        const _load = () => {
            try {
                const raw = sessionStorage.getItem(storageKey);
                if (!raw) return { count: 0, firstAt: 0 };
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    return {
                        count:   Number.isFinite(parsed.count)   ? parsed.count   : 0,
                        firstAt: Number.isFinite(parsed.firstAt) ? parsed.firstAt : 0,
                    };
                }
            } catch (_) {}
            return { count: 0, firstAt: 0 };
        };
        const _save = (g) => { try { sessionStorage.setItem(storageKey, JSON.stringify(g)); } catch (_) {} };

        return {
            tryReload(reason, logFn = console.log) {
                let g = _load();
                const now = Date.now();
                if (!g.firstAt || (now - g.firstAt) > windowMs) {
                    g = { count: 0, firstAt: now };
                }
                if (g.count >= maxReloads) {
                    logFn(`🚫 Reload guard: ${g.count} reloads in window — refusing further reloads.`);
                    return false;
                }
                g.count += 1;
                _save(g);
                logFn(`🔄 Recovery reload (${g.count}/${maxReloads})${reason ? ' — ' + reason : ''}`);
                try { location.reload(); } catch (_) {}
                return true;
            },
            clear() { try { sessionStorage.removeItem(storageKey); } catch (_) {} },
            status() { return _load(); }
        };
    }

    /* ====================================================================
       v1.3 — TABS WIRING
    ==================================================================== */
    function wireTabs(rootEl, { defaultTab } = {}) {
        if (!rootEl) return;
        const btns = rootEl.querySelectorAll('.ds-tab-btn[data-target]');
        const contents = rootEl.querySelectorAll('.ds-tab-content');
        const activate = (targetId) => {
            btns.forEach(b => b.classList.toggle('active', b.dataset.target === targetId));
            contents.forEach(c => c.classList.toggle('active', c.id === targetId));
        };
        btns.forEach(b => b.addEventListener('click', () => activate(b.dataset.target)));
        if (defaultTab) {
            activate(defaultTab);
        } else {
            const firstActive = rootEl.querySelector('.ds-tab-btn.active[data-target]');
            if (firstActive) activate(firstActive.dataset.target);
            else if (btns[0])  activate(btns[0].dataset.target);
        }
        return { activate };
    }

    /* ====================================================================
       v1.3 — STATS MODAL RENDER
    ==================================================================== */
    function renderStatsModal(modalEl, {
        title = '📊 Session Statistics',
        sections = [],
        lootTracker = null,
        baseUrl = BASE_URL,
        footerHTML = '',
    } = {}) {
        if (!modalEl) return;
        const sectionsHTML = sections.map(sec => {
            const boxes = (sec.stats || []).map(s => `
                <div class="ds-stat-box">
                    <div class="ds-stat-num" style="color:${s.color || '#fff'}">${escapeHtml(s.value ?? '0')}</div>
                    <div class="ds-stat-lbl">${escapeHtml(s.label || '')}</div>
                </div>
            `).join('');
            return `
                ${sec.title ? `<h3 class="ds-modal-title">${escapeHtml(sec.title)}</h3>` : ''}
                <div class="ds-stat-header">${boxes}</div>
            `;
        }).join('');
        const lootHTML = lootTracker
            ? `<h3 class="ds-modal-title" style="margin-top:20px;">🎒 Loot Collected</h3>
               <div class="ds-loot-grid">${buildLootGridHTML(lootTracker, baseUrl)}</div>`
            : '';
        modalEl.innerHTML = `
            <div class="ds-modal-header">
                <h2 style="margin:0;">${escapeHtml(title)}</h2>
                <button class="ds-stats-close" style="background:none;border:none;color:#888;font-size:24px;cursor:pointer;">&times;</button>
            </div>
            <div class="ds-modal-body">
                ${sectionsHTML}
                ${lootHTML}
                ${footerHTML}
            </div>
        `;
        const closeBtn = modalEl.querySelector('.ds-stats-close');
        if (closeBtn) closeBtn.addEventListener('click', () => { modalEl.style.display = 'none'; });
    }

    /* ====================================================================
       v1.3 — MONSTER TABLE
    ==================================================================== */
    function createMonsterTable(containerEl, {
        groups = [],
        getValues,
        onChange = () => {},
        columns = ['attack','name','ls','skill','cap'],
        bossNames = new Set(),
        skillOptions = SKILL_ORDER,
        collapseStateKey = null,
    } = {}) {
        if (!containerEl) throw new Error('[DSLib] createMonsterTable: containerEl required');
        if (typeof getValues !== 'function') throw new Error('[DSLib] createMonsterTable: getValues(name) required');

        const _loadCollapse = () => {
            if (!collapseStateKey) return {};
            try { return JSON.parse(sessionStorage.getItem(collapseStateKey) || '{}') || {}; }
            catch (_) { return {}; }
        };
        const _saveCollapse = (state) => {
            if (!collapseStateKey) return;
            try { sessionStorage.setItem(collapseStateKey, JSON.stringify(state)); } catch (_) {}
        };
        const collapse = _loadCollapse();

        const headerHTML = () => {
            const cells = [];
            if (columns.includes('attack')) cells.push('<th style="width:30px;">⚔</th>');
            if (columns.includes('name'))   cells.push('<th>Monster</th>');
            if (columns.includes('ls'))     cells.push('<th style="width:60px;">LS</th>');
            if (columns.includes('skill'))  cells.push('<th style="width:140px;">Skill</th>');
            if (columns.includes('cap'))    cells.push('<th style="width:100px;">Cap</th>');
            if (columns.includes('loot'))   cells.push('<th style="width:30px;">🎒</th>');
            return `<tr>${cells.join('')}</tr>`;
        };

        const cellHTML = (name, val) => {
            const cells = [];
            const isBoss = bossNames.has(name);
            const nameStyle = isBoss ? 'color:#ffd700; font-weight:bold;' : '';
            if (columns.includes('attack')) cells.push(`<td><input type="checkbox" class="dsmt-attack" ${val.attack ? 'checked' : ''}></td>`);
            if (columns.includes('name'))   cells.push(`<td style="${nameStyle}">${escapeHtml(name)}</td>`);
            if (columns.includes('ls'))     cells.push(`<td><input type="number" min="0" class="dsmt-ls ds-mon-input" value="${escapeAttr(val.ls ?? 0)}"></td>`);
            if (columns.includes('skill')) {
                const options = skillOptions.map(s => `<option value="${s}" ${val.skill === s ? 'selected' : ''}>${s.replace(/_/g, ' ')}</option>`).join('');
                cells.push(`<td><select class="dsmt-skill ds-mon-select">${options}</select></td>`);
            }
            if (columns.includes('cap'))    cells.push(`<td><input type="text" class="dsmt-cap ds-mon-input" value="${escapeAttr(val.cap ?? '0')}" placeholder="0"></td>`);
            if (columns.includes('loot'))   cells.push(`<td><input type="checkbox" class="dsmt-loot" ${val.loot ? 'checked' : ''}></td>`);
            return cells.join('');
        };

        const render = () => {
            const groupsHTML = groups.map((g, idx) => {
                const gid = `dsmt-grp-${idx}`;
                const isCollapsed = !!collapse[g.key || g.label];
                const rowsHTML = (g.monsters || []).map(name => {
                    const val = getValues(name) || {};
                    return `<tr data-name="${escapeAttr(name)}">${cellHTML(name, val)}</tr>`;
                }).join('');
                return `
                    <div class="dsmt-group" data-key="${escapeAttr(g.key || g.label || '')}">
                        <div class="dsmt-grp-header" style="background:${g.color || '#222'}; color:#fff; padding:6px 10px; margin-top:10px; cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
                            <span><strong>${g.icon ? g.icon + ' ' : ''}${escapeHtml(g.label || g.key || '')}</strong> <span style="color:#bbb;font-size:11px;">(${(g.monsters||[]).length})</span></span>
                            <span class="dsmt-toggle">${isCollapsed ? '▶' : '▼'}</span>
                        </div>
                        <table class="ds-mon-table" id="${gid}" style="${isCollapsed ? 'display:none;' : ''}">
                            <thead>${headerHTML()}</thead>
                            <tbody>${rowsHTML}</tbody>
                        </table>
                    </div>
                `;
            }).join('');
            containerEl.innerHTML = groupsHTML;
            bindEvents();
        };

        const bindEvents = () => {
            containerEl.querySelectorAll('.dsmt-grp-header').forEach(hdr => {
                hdr.addEventListener('click', () => {
                    const parent = hdr.parentElement;
                    const key = parent.dataset.key;
                    const tbl = parent.querySelector('table');
                    const toggle = hdr.querySelector('.dsmt-toggle');
                    const hidden = tbl.style.display === 'none';
                    tbl.style.display = hidden ? '' : 'none';
                    if (toggle) toggle.textContent = hidden ? '▼' : '▶';
                    collapse[key] = !hidden;
                    _saveCollapse(collapse);
                });
            });
            containerEl.querySelectorAll('tr[data-name]').forEach(tr => {
                const name = tr.dataset.name;
                const wire = (selector, fieldName, eventName, getValue) => {
                    const el = tr.querySelector(selector);
                    if (!el) return;
                    el.addEventListener(eventName, () => onChange(name, fieldName, getValue(el)));
                };
                wire('.dsmt-attack', 'attack', 'change', el => el.checked);
                wire('.dsmt-ls',     'ls',     'input',  el => Math.max(0, parseInt(el.value, 10) || 0));
                wire('.dsmt-skill',  'skill',  'change', el => el.value);
                wire('.dsmt-cap',    'cap',    'input',  el => el.value);
                wire('.dsmt-loot',   'loot',   'change', el => el.checked);
            });
        };

        render();
        return { refresh: render };
    }

    /* ====================================================================
       v1.3 — RUN SKILL PLAN
    ==================================================================== */
    async function runSkillPlan(plan, {
        performSkill,
        isRunning = () => true,
        ensureStamina,
        onAttack = () => {},
        cap = Infinity,
        startingDmg = 0,
        attackDelayMs = 1000,
        randMs = 200,
    } = {}) {
        if (typeof performSkill !== 'function') throw new Error('[DSLib] runSkillPlan: performSkill(fn) required');
        let totalDmg = startingDmg;
        let i = 0;
        let stopReason = 'completed';

        const flatPlan = [];
        for (const entry of (plan || [])) {
            const count = Math.max(0, Number(entry.count) || 0);
            for (let k = 0; k < count; k++) flatPlan.push(entry.skill);
        }

        while (i < flatPlan.length) {
            if (!isRunning()) { stopReason = 'stopped'; break; }
            if (totalDmg >= cap) { stopReason = 'cap_reached'; break; }

            const skillName = flatPlan[i];
            const skillDef = SKILLS[skillName];
            if (!skillDef) { i++; continue; }

            if (typeof ensureStamina === 'function') {
                const ok = await ensureStamina(skillDef.cost);
                if (!ok) { stopReason = 'no_stamina'; break; }
            }

            const result = await performSkill(skillName, i);
            if (!result || result.ok === false) {
                if (result && result.retry) { /* same i */ }
                else { stopReason = (result && result.stopReason) || 'perform_failed'; break; }
            } else {
                totalDmg += Number(result.dmgDealt) || 0;
                onAttack(i, result);
                i++;
            }
            if (attackDelayMs > 0) await sleep(attackDelayMs + rand(0, randMs));
        }
        return { totalDmg, completed: stopReason === 'completed' || stopReason === 'cap_reached', stopReason };
    }

    /* ====================================================================
       v1.3 — IFRAME HELPERS
    ==================================================================== */
    const iframe = {
        create(width = 1, height = 1) {
            const f = document.createElement('iframe');
            f.style.cssText = `position:fixed; left:-9999px; top:-9999px; width:${width}px; height:${height}px; border:0; visibility:hidden;`;
            document.body.appendChild(f);
            return f;
        },
        async waitForLoad(iframeEl, { timeoutMs = 30000 } = {}) {
            return new Promise((resolve, reject) => {
                let done = false;
                const t = setTimeout(() => {
                    if (done) return;
                    done = true;
                    reject(new Error('iframe load timeout'));
                }, timeoutMs);
                iframeEl.addEventListener('load', () => {
                    if (done) return;
                    done = true;
                    clearTimeout(t);
                    resolve(iframeEl);
                }, { once: true });
            });
        },
        async waitFor(predicate, { timeoutMs = 30000, intervalMs = 200, label = 'condition' } = {}) {
            const start = Date.now();
            while (Date.now() - start < timeoutMs) {
                try {
                    const v = await predicate();
                    if (v) return v;
                } catch (_) {}
                await sleep(intervalMs);
            }
            throw new Error(`waitFor(${label}) timed out`);
        },
        async simulateDrag(iframeEl, fromEl, toEl, { steps = 12, holdMs = 50 } = {}) {
            if (!iframeEl || !iframeEl.contentDocument) throw new Error('iframe has no contentDocument');
            const doc = iframeEl.contentDocument;
            const win = iframeEl.contentWindow;
            const fromRect = fromEl.getBoundingClientRect();
            const toRect   = toEl.getBoundingClientRect();
            const sx = fromRect.left + fromRect.width  / 2;
            const sy = fromRect.top  + fromRect.height / 2;
            const ex = toRect.left   + toRect.width    / 2;
            const ey = toRect.top    + toRect.height   / 2;

            const evt = (type, x, y, target) => {
                const e = new win.PointerEvent(type, {
                    bubbles: true, cancelable: true, composed: true,
                    pointerType: 'mouse', clientX: x, clientY: y, button: 0, buttons: 1,
                });
                target.dispatchEvent(e);
            };
            evt('pointerdown', sx, sy, fromEl);
            for (let s = 1; s <= steps; s++) {
                const t = s / steps;
                const x = sx + (ex - sx) * t;
                const y = sy + (ey - sy) * t;
                evt('pointermove', x, y, doc.elementFromPoint(x, y) || toEl);
                await sleep(holdMs);
            }
            evt('pointerup', ex, ey, toEl);
        }
    };

    /* ==================================================================== */
    return {
        VERSION,
        SKILLS, SKILL_ORDER, STATUS_COLORS, TIER_STYLES, POTION_NAMES,
        BASE_URL, USE_ITEM_URL, HP_POT_URL, INVENTORY_URL, PLAYER_STATS_URL,
        FORM_HEADERS,
        getCookie, setCookie, now, sleep, rand,
        buildFormBody, postForm,
        parseDamageCap, toNonNeg,
        makeDraggable, createLogChannel,
        injectBaseCSS,
        formatBigNumber, formatDuration, formatClock,
        escapeHtml, escapeAttr, isChallengeDocument,
        extractPlayerStatsFromDoc, getPlayerStatsFromWave, parseHpFromBattle,
        fetchInventoryIds,
        useItemByInvId, useStaminaPotion,
        refillHp, handleStaminaLogic,
        processLootItems,
        buildLootGridHTML,
        createSettingsManager,
        createSessionStats,
        createFloatingPanel,
        createChallengeGuard,
        createIntervalLoop,
        createReloadGuard,
        createMonsterTable,
        renderStatsModal,
        wireTabs,
        runSkillPlan,
        iframe,
    };
})();
