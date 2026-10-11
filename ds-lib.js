// ==UserScript==
// @name         DSLib — Shared utilities for Demonicscans automators
// @namespace    demonicscans-lib
// @version      1.7
// @description  Shared constants, utilities, CSS and API helpers for DS automator scripts
// @author       Niokhy
// ==/UserScript==
/**
 * DSLib — exposed as a global so any @require-ing script can use it.
 *
 * Usage in another script's header:
 *   // @require  file:///C:/path/to/ds-lib.js
 *   // @require  https://cdn.jsdelivr.net/gh/your-user/your-repo@1.5/ds-lib.js
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
 *
 * v1.4 (mineure) — Class & Mana system :
 *   - Constants  : MAX_MANA, CLASS_SKILLS, JUDGMENT_BOOSTABLE_SKILLS,
 *                  CLASSES_URL, BATTLE_URL, DAMAGE_URL.
 *   - Pure fns   : extractManaFromDoc, fetchPlayerClass, fetchManaFromBattle,
 *                  castClassSkill.
 *   - Decision   : getActiveJudgmentSeal(sharedSettings),
 *                  shouldCastJudgmentSeal(skillName, isBoss, sharedSettings).
 *   - Stateful   : createManaManager({ ... }) — encapsule mana state + refill flow.
 *
 * v1.5 (mineure) — Kill switch (3 niveaux) :
 *   - Niveau 1 = REQUIRED_DSLIB_VERSION (mécanisme existant).
 *   - Niveau 2 = suppression du tag GitHub (procédure manuelle).
 *   - Niveau 3 = manifest.json distant fetché au démarrage. Si la version
 *                est dans killedVersions OU < minSupported → DSLib.ready
 *                resolve avec { ok: false, reason } et les scripts qui
 *                awaitent ready peuvent refuser de démarrer.
 *   - Exports  : DSLib.ready (Promise<{ok, reason?, manifest?}>),
 *                DSLib.compareVersions(a, b).
 *   - Usage côté script :
 *        const r = await DSLib.ready;
 *        if (!r.ok) { console.error(r.reason); return; }
 *
 * v1.6 (mineure) — Stack support : getStackCount, sumStackCounts, pickCardsForCount.
 *
 * v1.7 (mineure) — Refactorisation Veyra 1.137 (helpers extraits du script) :
 *   - Nouveaux helpers :
 *       • fetchDoc(url, { throwOnError, noStore, withHtml })  — GET → Document
 *       • withCookie(name, value, asyncFn)                   — bascule temporaire d'un cookie
 *       • formatCountdown(ms)                                — "2h 5m" / "5m 12s" / "12s"
 *       • loadCounters(key, names, opts) / saveCounters(key, obj, opts)
 *                                                            — compteurs de session (toNonNeg)
 *       • createJsonStore(key, { storage, fallback })        — petit état JSON persistant
 *       • createTypedLogBuffer({ elementId, max, ... })      — console typée info/success/warn/error
 *       • createHourlyScheduler({ getIntervalMs, run, ... }) — cycle setTimeout enchaîné + runNow
 *       • renderOrderList(container, opts)                   — liste drag & drop + toggle
 *       • makeElementDraggable(el, opts)                     — drag d'un panel/modal + persistance
 *   - processLootItems : accepte aussi les clés MAJUSCULES (ITEM_ID, NAME, IMAGE_URL, TIER,
 *     QUANTITY, COUNT) — la normalisation dupliquée dans Veyra (Wave + Dungeon) est supprimée.
 *   - castClassSkill / fetchManaFromBattle / createManaManager.refresh+castSeal :
 *     la cible peut aussi être un monstre de donjon { instanceId, dgmid }
 *     (damage.php reçoit instance_id + dgmid, battle.php?dgmid=&instance_id=).
 *   - runHitLoop({ plan, cap, startDmg, attack, refillStamina, heal, beforeHit, onResult,
 *     stop, messages… }) — boucle de coups (ex-runDungeonHits de Veyra) ; runSkillPlan
 *     reste disponible mais n'est utilisé par aucun script.
 *   - createChallengeGuard : options shouldContinue, checkOrder, messages.
 *   - createReloadGuard : options lockKey/lockMs + méthodes request(reason, { onReload, onLimit }),
 *     isLocked(), lockUntil(), clearLock() (tryReload inchangé).
 *   - createManaManager : Full Mana Potion (useManaPotionF + fullManaPotionId) ;
 *     ordre F→L→S à mana 0, S→L→F sinon ; isPotionFDepleted().
 *   - fetchInventoryPage / invalidateInventoryCache : lecture partagée d'inventory.php
 *     (cache 5 s, requête en vol partagée) ; fetchInventoryIds l'utilise.
 *   - handleStaminaLogic : options onPotionFail/stopFn, refillCountMode, logPrefix ;
 *     retourne aussi `stopped`.
 *   - handleStaminaLogic : option isRunning: () => bool (la boucle SSP gap-fill voit un Stop
 *     en cours de route ; le booléen `running` reste accepté).
 *   - iframe.withHidden(url, fn, { width, height, timeoutMs }) — crée/charge/exécute/supprime
 *     toujours ; iframe.muteDialogs(iframeOrWindow).
 *   - ⚠ Contrat modifié (aucun consommateur avant Veyra 1.137) :
 *   - iframe.create ajoute aria-hidden ; iframe.waitFor accepte un prédicat synchrone et son
 *     message d'erreur devient "waitFor timeout: <label>" ; iframe.simulateDrag reprend la
 *     version éprouvée de Veyra (scrollIntoView, pointermove/up aussi sur document,
 *     buttons:0 au pointerup, pointerId/isPrimary/view) — options steps/stepMs/holdMs/onCoords.
 */
const DSLib = (() => {
    'use strict';
    /* ====================================================================
       VERSION
       Bump this string every time ds-lib.js changes in a breaking way.
       Scripts that declare a different REQUIRED_DSLIB_VERSION will
       refuse to start, forcing the user to update all scripts together.
    ==================================================================== */
    const VERSION = '1.7';
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
       CLASS & MANA — URLs + Constants (v1.4)
    ==================================================================== */
    const CLASSES_URL = 'https://demonicscans.org/classes.php';
    const BATTLE_URL  = 'https://demonicscans.org/battle.php';
    const DAMAGE_URL  = 'https://demonicscans.org/damage.php';
    /** Mana max (hardcoded — to be replaced by per-class lookup if the game changes). */
    const MAX_MANA = 200;
    /** Per-class skill definitions. id is sent to damage.php as skill_id ; manaCost is what the server actually deducts ; stamCost is what the API expects in the body field stamina_cost. */
    const CLASS_SKILLS = {
        Cleric: {
            JUDGMENT_SEAL: { id: 9, manaCost: 30, stamCost: 1, name: 'Judgment Seal' }
        }
        // Other classes : add when their useful skills are documented.
    };
    /** Skills that Judgment Seal boosts (per game spec — v11.0). */
    const JUDGMENT_BOOSTABLE_SKILLS = new Set(['LEGENDARY_SLASH', 'WORLD_BREAKER_SLASH']);
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
       v1.6 — STACK SUPPORT
       The "Show unclaimed kills" page on demonicscans.org groups dead
       monsters of the same name into stacks (max 250 per stack). The DOM
       still emits one .monster-card per stack, with all the usual
       data-* attributes (data-monster-id, data-dead, data-eligible,
       data-userdmg, data-name), PLUS a <div class="stack-badge">Stack xN</div>
       inside the card. data-userdmg applies per-monster (the whole stack
       is uniformly battled).

       For counting purposes (quest progress, ready/inProgress counters),
       each card must be multiplied by its stack count. For loot, a single
       loot.php call with the card's monster-id empties the entire stack.
    ==================================================================== */
    /**
     * Lit la pastille .stack-badge à l'intérieur d'une monster-card et
     * renvoie le nombre de monstres dans le stack. Retourne 1 si la
     * pastille est absente (compat ascendante — cards sans stack).
     */
    function getStackCount(card) {
        if (!card || typeof card.querySelector !== 'function') return 1;
        const badge = card.querySelector('.stack-badge');
        if (!badge) return 1;
        const m = (badge.textContent || '').match(/(\d+)/);
        if (!m) return 1;
        const n = parseInt(m[1], 10);
        return Number.isFinite(n) && n > 0 ? n : 1;
    }
    /**
     * Helper qui somme les stack counts d'un ensemble de cards. Pratique
     * pour les compteurs ready/inProgress qui passaient avant par .length.
     */
    function sumStackCounts(cards) {
        if (!cards) return 0;
        let total = 0;
        for (const c of cards) total += getStackCount(c);
        return total;
    }
    /**
     * Pour les fonctions qui sélectionnent les targets à looter en visant
     * un total cumulatif (ex: kill 10 monstres), retourne le sous-ensemble
     * de cards dont la somme des stack counts atteint targetCount. Garantit
     * d'en prendre au moins une si la liste n'est pas vide.
     */
    function pickCardsForCount(cards, targetCount) {
        const picked = [];
        let collected = 0;
        for (const c of (cards || [])) {
            if (collected >= targetCount) break;
            picked.push(c);
            collected += getStackCount(c);
        }
        return { picked, collected };
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
    /* ====================================================================
       v1.7 — SHARED inventory.php READ (short cache)
       Several modules read inventory.php at the same moment (potion stocks,
       potion ID sync, auto-detect…). One request is shared: concurrent calls
       reuse the in-flight request, and a result younger than maxAgeMs is
       reused. Using an item (useItemByInvId) invalidates the cache.
       Resolves { doc, html } — or null on HTTP error; rejects on network error.
    ==================================================================== */
    const INVENTORY_CACHE_MS = 5000;
    let _invCache = { at: 0, page: null, inFlight: null };
    function invalidateInventoryCache() { _invCache = { at: 0, page: null, inFlight: null }; }
    function fetchInventoryPage({ maxAgeMs = INVENTORY_CACHE_MS } = {}) {
        if (_invCache.page && Date.now() - _invCache.at < maxAgeMs) return Promise.resolve(_invCache.page);
        if (_invCache.inFlight) return _invCache.inFlight;
        const p = (async () => {
            const response = await fetch(INVENTORY_URL, { credentials: 'same-origin' });
            if (!response.ok) return null;
            const html = await response.text();
            return { doc: new DOMParser().parseFromString(html, 'text/html'), html };
        })();
        _invCache.inFlight = p;
        p.then(page => {
            if (_invCache.inFlight !== p) return;            // invalidated meanwhile
            _invCache = { at: Date.now(), page, inFlight: null };
        }, () => { if (_invCache.inFlight === p) _invCache.inFlight = null; });
        return p;
    }

    async function fetchInventoryIds({ onUpdate, logFn = console.log, extraNames, maxAgeMs } = {}) {
        const names = extraNames ? new Set([...POTION_NAMES, ...extraNames]) : POTION_NAMES;
        try {
            const page = await fetchInventoryPage({ maxAgeMs });
            if (!page) return;
            const doc = page.doc;
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
            invalidateInventoryCache();   // v1.7 — stocks changed
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
    /**
     * Stamina refill tiers: SSP gap-fill → Large → Full → plain SSP.
     * v1.7 options (defaults = historical behaviour):
     *   isRunning()        — live running flag (preferred over the `running` boolean);
     *                        once false, no further potion is used.
     *   onPotionFail       — 'continue' (default) or 'stop': a failed potion call
     *                        calls stopFn('Stamina potion failed') and ends the logic.
     *   stopFn(reason)     — used with onPotionFail:'stop'.
     *   refillCountMode    — 'lspFsp' (default: only Large/Full count toward
     *                        maxStaminaRefills) or 'any' (any successful refill counts once).
     *   logPrefix          — inserted after the emoji of every log line (e.g. '[AUTO] ').
     * Returns { success, stopped, currentStamina, staminaRefillsUsed, sspRefillsUsed, largePotionsDepleted }.
     */
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
            isRunning             = null,
            onPotionFail          = 'continue',
            stopFn                = () => {},
            refillCountMode       = 'lspFsp',
            logPrefix             = '',
            currentExpRatio       = 0,
            logFn                 = console.log,
            persistStatsFn        = () => {}
        } = ctx;
        let currentStamina       = ctx.currentStamina       ?? 0;
        let staminaRefillsUsed   = ctx.staminaRefillsUsed   ?? 0;
        let sspRefillsUsed       = ctx.sspRefillsUsed       ?? 0;
        let largePotionsDepleted = ctx.largePotionsDepleted ?? false;
        let success = false, stopped = false, lspFspUsed = false;
        const ret = () => ({ success, stopped, currentStamina, staminaRefillsUsed, sspRefillsUsed, largePotionsDepleted });
        const stillRunning = () => (typeof isRunning === 'function' ? !!isRunning() : running);
        // '🧪 text' → '🧪 [AUTO] text' when logPrefix is set
        const log = (msg) => logFn(logPrefix ? String(msg).replace(/^(\S+)\s/, `$1 ${logPrefix}`) : msg);
        const opts = { enableCalls, logFn };
        const usePotion = async (invId, label) => {
            const ok = await useItemByInvId(invId, label, opts);
            if (!ok && onPotionFail === 'stop') { stopFn('Stamina potion failed'); stopped = true; }
            return ok;
        };
        // Ends the logic after a potion failure in 'stop' mode (success forced
        // false), or when automation was stopped meanwhile (no further potion).
        // A potion that already succeeded is still counted when the automation
        // was stopped meanwhile (it has been consumed).
        let counted = false;
        const countRefill = (lspFsp) => {
            if (counted) return;
            if (refillCountMode === 'any' || lspFsp) {
                counted = true;
                staminaRefillsUsed++;
                persistStatsFn();
                log(refillCountMode === 'any'
                    ? `⚡ Stamina Refilled. Total Used: ${staminaRefillsUsed}/${maxStaminaRefills}`
                    : `⚡ Stamina Refilled. Total LSP/FSP used: ${staminaRefillsUsed}/${maxStaminaRefills}`);
            }
        };
        const halted = () => {
            if (stopped) { success = false; return true; }
            if (!stillRunning()) { stopped = true; if (success) countRefill(lspFspUsed); return true; }
            return false;
        };

        if (currentExpRatio >= expThreshold) {
            log(`📉 EXP Threshold reached (${(currentExpRatio * 100).toFixed(1)}%). Stopping refills.`);
            return ret();
        }
        if (staminaRefillsUsed >= maxStaminaRefills) {
            log(`🛑 Max refills reached (${staminaRefillsUsed}/${maxStaminaRefills}). Stopping refills.`);
            return ret();
        }
        if (!useLargeStamina && !useFullStamina && !enableSsp && !sspFillGap) {
            log('🛑 No stamina potion type enabled. Stopping refills.');
            return ret();
        }
        if (!success && sspFillGap && sspRefillsUsed < maxSspRefills && smallStaminaPotionId) {
            if (currentStamina > sspMinThreshold) {
                log(`🧪 SSP gap-fill: stamina ${currentStamina} > min ${sspMinThreshold}. Filling toward ${staminaThreshold}…`);
                while (currentStamina < staminaThreshold && sspRefillsUsed < maxSspRefills && stillRunning()) {
                    const ok = await usePotion(smallStaminaPotionId, 'Small Stamina Potion');
                    if (!ok) { log('⚠️ Out of Small Stamina Potions.'); break; }
                    sspRefillsUsed++;
                    currentStamina += 20;
                    persistStatsFn();
                    log(`⚡ SSP used (${sspRefillsUsed}/${maxSspRefills}). Stamina ~${currentStamina}.`);
                }
                if (halted()) return ret();
                success = currentStamina >= staminaThreshold;
            } else {
                log(`⏭️ SSP gap-fill skipped: stamina ${currentStamina} ≤ min ${sspMinThreshold}. Trying LSP/FSP.`);
            }
        }
        if (!success && useLargeStamina && !largePotionsDepleted) {
            log('🧪 Consuming Large Stamina Potion…');
            success = await usePotion(largeStaminaPotionId, 'Large Stamina Potion');
            if (!success) {
                log('⚠️ Out of Large Stamina Potions. Marking as depleted.');
                largePotionsDepleted = true;
            } else {
                lspFspUsed = true;
            }
        }
        if (halted()) return ret();
        if (!success && useFullStamina) {
            log('🧪 Consuming Full Stamina Potion…');
            success = await usePotion(fullStaminaPotionId, 'Full Stamina Potion');
            if (success) lspFspUsed = true;
        }
        if (halted()) return ret();
        if (!success && enableSsp && sspRefillsUsed < maxSspRefills && smallStaminaPotionId) {
            log('🧪 Consuming Small Stamina Potion…');
            const ok = await usePotion(smallStaminaPotionId, 'Small Stamina Potion');
            if (ok) {
                sspRefillsUsed++;
                persistStatsFn();
                log(`🧪 SSP used. Total: ${sspRefillsUsed}/${maxSspRefills}`);
                success = true;
            }
            if (halted()) return ret();
        }
        if (success) {
            countRefill(lspFspUsed);
        } else {
            log('⚠️ No usable Stamina Potions found.');
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
            // v1.7 — also accepts the UPPERCASE keys some endpoints return.
            const id = item.id || item.inv_id || item.item_id || item.ITEM_ID;
            if (!id) return;
            if (!lootTracker[id]) {
                lootTracker[id] = {
                    count: 0,
                    img:   item.img   || item.image || item.IMAGE_URL || '',
                    name:  item.name  || item.NAME  || '',
                    tier:  (item.tier || item.TIER  || 'COMMON').toUpperCase()
                };
            }
            lootTracker[id].count += (item.quantity || item.QUANTITY || item.count || item.COUNT || 1);
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
    /**
     * Waits for a Cloudflare challenge to clear (poll every pollMs).
     * v1.7 options (defaults = historical behaviour):
     *   shouldContinue()  — polled first on each tick; false → stops silently
     *                       (e.g. automation stopped meanwhile).
     *   checkOrder        — 'timeoutFirst' (default) or 'clearFirst'.
     *   messages          — { detected(reason), cleared, timeout }: string,
     *                       function or null (= no log) to override each log line.
     */
    function createChallengeGuard({
        pollMs   = 2500,
        timeoutMs = 120000,
        isChallenge = () => isChallengeDocument(document),
        onClear  = () => {},
        onTimeout = () => {},
        logFn    = console.log,
        shouldContinue = () => true,
        checkOrder = 'timeoutFirst',
        messages = {},
    } = {}) {
        let _timerId  = null;
        let _startAt  = 0;
        const _active = () => _timerId !== null;
        const DEFAULT_MSGS = {
            detected: (reason) => `🛡️ Cloudflare challenge detected${reason ? ` (${reason})` : ''}. Waiting…`,
            cleared:  '✅ Challenge cleared — resuming.',
            timeout:  '⏱️ Challenge wait timed out.',
        };
        const say = (key, arg) => {
            const m = (key in messages) ? messages[key] : DEFAULT_MSGS[key];
            if (m === null || m === undefined) return;
            logFn(typeof m === 'function' ? m(arg) : m);
        };

        function tick() {
            if (!shouldContinue()) { stop(); return; }
            const timedOut = () => {
                if (Date.now() - _startAt < timeoutMs) return false;
                stop();
                say('timeout');
                try { onTimeout('timeout'); } catch (_) {}
                return true;
            };
            const cleared = () => {
                if (isChallenge()) return false;
                stop();
                say('cleared');
                try { onClear(); } catch (_) {}
                return true;
            };
            if (checkOrder === 'clearFirst') { if (!cleared()) timedOut(); }
            else                             { if (!timedOut()) cleared(); }
        }

        function schedule(reason) {
            if (_active()) return;
            _startAt = Date.now();
            say('detected', reason);
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
    function createReloadGuard({ storageKey, maxReloads = 3, windowMs = 120000, lockKey = null, lockMs = 10 * 60 * 1000 } = {}) {
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
            /**
             * v1.7 — reload request with a persistent lock once the limit is hit.
             * Counts within windowMs (count = 1 outside the window); beyond
             * maxReloads: sets the lock (lockKey/lockMs), calls onLimit(max) and
             * returns false WITHOUT clearing the counter (a pending reload must
             * not restart at 1 → endless loop). Otherwise onReload(count, max)
             * then location.reload(), returns true. No log of its own.
             */
            request(reason, { onReload = () => {}, onLimit = () => {} } = {}) {
                const t = Date.now();
                const g = _load();
                const inWindow = g.firstAt > 0 && (t - g.firstAt) < windowMs;
                const next = { count: inWindow ? g.count + 1 : 1, firstAt: inWindow ? g.firstAt : t };
                _save(next);
                if (next.count > maxReloads) {
                    if (lockKey) { try { sessionStorage.setItem(lockKey, String(t + lockMs)); } catch (_) {} }
                    try { onLimit(maxReloads); } catch (_) {}
                    return false;
                }
                try { onReload(next.count, maxReloads); } catch (_) {}
                try { location.reload(); } catch (_) {}
                return true;
            },
            lockUntil() { if (!lockKey) return 0; try { return Number(sessionStorage.getItem(lockKey)) || 0; } catch (_) { return 0; } },
            isLocked()  { return this.lockUntil() > Date.now(); },
            clearLock() { if (lockKey) { try { sessionStorage.removeItem(lockKey); } catch (_) {} } },
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
       v1.7 — HIT LOOP (extracted from Veyra's Dungeon runDungeonHits)
       Runs a plan of hits on one target: cap check before each hit, stamina
       refill + retry of the same hit, optional pre-hit hook (Judgment Seal),
       server "Not enough stamina" (refill + retry) / "You are dead" (heal +
       one retry) handling, per-hit result hook, kill detection.
       The damage is the absolute total sent back by damage.php (totaldmgdealt).
       Returns { dmg, reason } — reason: 'done' | 'cap' | 'killed' | 'error' |
       'stopped' (isRunning() false) | 'aborted' (stop(reason) was called).
    ==================================================================== */
    const HIT_LOOP_MSGS = {
        capNext:       'Moving to next.',
        errorNext:     'Moving to next monster.',
        lowStamina:    (have, cost) => `📉 Not enough stamina for ${cost}-cost skill (have ${have}). Using potion...`,
        serverLowLog:  '📉 Server: not enough stamina. Using potion...',
        serverLowStop: 'Server reported not enough stamina and refill failed.',
        noPotionStop:  'Out of stamina and no potion available.',
        retryLog:      (n, total) => `💥 Retrying attack ${n}/${total}...`,
        retryFallback: 'Network Error',
        hit:           (n, total, dmg) => `💥 Attack ${n}/${total} OK. Total dmg: ${dmg}`,
    };
    async function runHitLoop({
        plan = [], cap = Infinity, startDmg = 0, name = 'target',
        isRunning = () => true,
        getStamina = () => Infinity,
        refillStamina = async () => false,   // → true when stamina was refilled
        beforeHit = async () => {},          // (skill, index)
        attack,                              // (skill) → damage.php JSON | null
        heal = async () => {},
        onResult = async () => {},           // (result) — stamina / HP / UI updates
        stop = () => {},                     // (reason) — stops the automation
        logFn = console.log,
        messages = {},
    } = {}) {
        if (typeof attack !== 'function') throw new Error('[DSLib] runHitLoop: attack(fn) required');
        const M = { ...HIT_LOOP_MSGS, ...messages };
        const total = plan.length;
        let dmg = startDmg;
        for (let i = 0; i < total; i++) {
            if (!isRunning()) return { dmg, reason: 'stopped' };
            if (cap !== Infinity && dmg >= cap) {
                logFn(`🛑 Cap reached (${dmg.toLocaleString()} / ${cap.toLocaleString()}). ${M.capNext}`);
                return { dmg, reason: 'cap' };
            }
            const skill = plan[i];
            if (getStamina() < skill.cost) {
                logFn(M.lowStamina(getStamina(), skill.cost));
                if (!(await refillStamina())) { stop(M.noPotionStop); return { dmg, reason: 'aborted' }; }
                i--;
                continue;
            }
            await beforeHit(skill, i);
            let result = await attack(skill);
            if (!result || result.status !== 'success') {
                const errorMsg = String(result?.message ?? 'Network Error');
                if (errorMsg.includes('Not enough stamina')) {
                    if (M.serverLowLog) logFn(M.serverLowLog);
                    if (!(await refillStamina())) { stop(M.serverLowStop); return { dmg, reason: 'aborted' }; }
                    i--;
                    continue;
                } else if (errorMsg.includes('You are dead')) {
                    logFn('🚑 HP Critical! Healing...');
                    await heal();
                    if (M.retryLog) logFn(M.retryLog(i + 1, total));
                    const retry = await attack(skill);
                    if (!retry || retry.status !== 'success') {
                        stop(`Retry after heal failed: ${String(retry?.message ?? M.retryFallback)}`);
                        return { dmg, reason: 'aborted' };
                    }
                    result = retry;
                } else {
                    logFn(`🛑 Attack error: ${errorMsg}. ${M.errorNext}`);
                    return { dmg, reason: 'error' };
                }
            }
            await onResult(result);
            dmg = result.totaldmgdealt || 0;
            logFn(M.hit(i + 1, total, dmg.toLocaleString()));
            if (result.hp && result.hp.value <= 0) { logFn(`💀 ${name} Defeated!`); return { dmg, reason: 'killed' }; }
        }
        return { dmg, reason: 'done' };
    }

    /* ====================================================================
       v1.3 — IFRAME HELPERS
    ==================================================================== */
    const iframe = {
        create(width = 1, height = 1) {
            const f = document.createElement('iframe');
            f.style.cssText = `position:fixed; left:-9999px; top:-9999px; width:${width}px; height:${height}px; border:0; visibility:hidden;`;
            f.setAttribute('aria-hidden', 'true');   // v1.7
            document.body.appendChild(f);
            return f;
        },
        async waitForLoad(iframeEl, { timeoutMs = 30000 } = {}) {
            return new Promise((resolve, reject) => {
                let done = false;
                const onLoad = () => {
                    if (done) return;
                    done = true;
                    clearTimeout(t);
                    resolve(iframeEl);
                };
                const t = setTimeout(() => {
                    if (done) return;
                    done = true;
                    iframeEl.removeEventListener('load', onLoad);
                    reject(new Error('iframe load timeout'));
                }, timeoutMs);
                iframeEl.addEventListener('load', onLoad, { once: true });
            });
        },
        /**
         * v1.7 — create a hidden iframe, load `url`, run fn(iframeEl) and ALWAYS
         * remove the iframe afterwards (success, error or timeout). Resolves
         * with fn's result; rejects with the load timeout or fn's error.
         */
        async withHidden(url, fn, { width = 1280, height = 800, timeoutMs = 20000 } = {}) {
            const f = iframe.create(width, height);
            try {
                f.src = url;
                await iframe.waitForLoad(f, { timeoutMs });
                return await fn(f);
            } finally {
                try { f.remove(); } catch (_) {}
            }
        },
        /** v1.7 — neutralise confirm/alert/prompt of an iframe (element) or a window. */
        muteDialogs(target) {
            try {
                const w = (target && target.contentWindow) ? target.contentWindow : target;
                if (!w) return false;
                w.confirm = () => true;
                w.alert   = () => {};
                w.prompt  = () => '';
                return true;
            } catch (_) { return false; }   // cross-origin guard
        },
        /** Polls predicate (sync or async) until truthy. v1.7: error text "waitFor timeout: <label>". */
        async waitFor(predicate, { timeoutMs = 30000, intervalMs = 200, label = '' } = {}) {
            const start = Date.now();
            for (;;) {
                try {
                    const v = await predicate();
                    if (v) return v;
                } catch (_) { /* not ready yet */ }
                if (Date.now() - start > timeoutMs) throw new Error(`waitFor timeout${label ? ': ' + label : ''}`);
                await sleep(intervalMs);
            }
        },
        /**
         * v1.7 — Simulated pointer drag between two elements of an iframe
         * (version proven on the Shadow army battle UI, taken from Veyra).
         * Scrolls both endpoints into view, dispatches pointerdown on fromEl,
         * `steps` pointermove on fromEl AND document, then pointerup on toEl
         * AND document (buttons:0).
         */
        async simulateDrag(iframeEl, fromEl, toEl, { steps = 16, stepMs = 25, holdMs = 50, scrollIntoView = true, onCoords = null } = {}) {
            const win = iframeEl && iframeEl.contentWindow;
            const doc = iframeEl && iframeEl.contentDocument;
            if (!win || !doc) throw new Error('iframe content not accessible');
            const PE = win.PointerEvent || PointerEvent;

            if (scrollIntoView) {
                try { fromEl.scrollIntoView({ block: 'center', inline: 'center' }); } catch (_) {}
                try { toEl.scrollIntoView({ block: 'center', inline: 'center' }); } catch (_) {}
                await sleep(200);
            }

            const fromRect = fromEl.getBoundingClientRect();
            const toRect   = toEl.getBoundingClientRect();
            const fromX = fromRect.left + fromRect.width  / 2;
            const fromY = fromRect.top  + fromRect.height / 2;
            const toX   = toRect.left   + toRect.width    / 2;
            const toY   = toRect.top    + toRect.height   / 2;
            if (typeof onCoords === 'function') {
                try { onCoords({ fromX, fromY, toX, toY, viewportW: win.innerWidth, viewportH: win.innerHeight }); } catch (_) {}
            }

            const mk = (type, x, y) => new PE(type, {
                bubbles: true, cancelable: true,
                pointerType: 'mouse', isPrimary: true, pointerId: 1,
                clientX: x, clientY: y, screenX: x, screenY: y,
                button: 0, buttons: type === 'pointerup' ? 0 : 1,
                view: win
            });

            fromEl.dispatchEvent(mk('pointerdown', fromX, fromY));
            await sleep(holdMs);
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const x = fromX + (toX - fromX) * t;
                const y = fromY + (toY - fromY) * t;
                fromEl.dispatchEvent(mk('pointermove', x, y));
                doc.dispatchEvent(mk('pointermove', x, y));
                await sleep(stepMs);
            }
            toEl.dispatchEvent(mk('pointerup', toX, toY));
            doc.dispatchEvent(mk('pointerup', toX, toY));
        }
    };

    /* ====================================================================
       v1.4 — CLASS & MANA — Pure functions
    ==================================================================== */
    /** Parse current/max mana from any document containing "💠 N / N MP". */
    function extractManaFromDoc(doc) {
        try {
            const text = doc?.body?.textContent || '';
            const m = text.match(/(\d[\d,]*)\s*\/\s*(\d[\d,]*)\s*MP/i);
            if (!m) return null;
            const current = parseInt(m[1].replace(/,/g, ''), 10);
            const max     = parseInt(m[2].replace(/,/g, ''), 10);
            if (Number.isNaN(current) || Number.isNaN(max)) return null;
            return { current, max };
        } catch (_) { return null; }
    }
    /** Fetch the player class from classes.php. Returns string ("Cleric") or null. */
    async function fetchPlayerClass({ logFn = console.log } = {}) {
        try {
            const response = await fetch(CLASSES_URL, { credentials: 'same-origin' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
            const text = doc?.body?.textContent || '';
            const m = text.match(/Your class\s*:\s*([A-Za-z][A-Za-z\s\-']{1,40})/i);
            if (!m) { logFn('⚠️ [CLASS] Could not detect class from classes.php.'); return null; }
            const cls = m[1].trim().split(/\s+/)[0];
            logFn(`⚔️ [CLASS] Detected class: ${cls}`);
            return cls;
        } catch (err) {
            logFn('⚠️ [CLASS] Class fetch failed.');
            console.error('Class fetch failed', err);
            return null;
        }
    }
    /** Fetch current mana from a battle page. Auto-picks a monster id if none provided. */
    /**
     * v1.7 — battle target: a wave monster id (number/string) or a guild
     * dungeon monster { instanceId, dgmid }. Returns the battle.php query
     * string and the damage.php body params identifying the target.
     */
    function battleTarget(target) {
        if (target && typeof target === 'object' && target.dgmid) {
            return {
                query:  `dgmid=${encodeURIComponent(target.dgmid)}&instance_id=${encodeURIComponent(target.instanceId)}`,
                params: { instance_id: target.instanceId, dgmid: target.dgmid },
            };
        }
        return { query: `id=${encodeURIComponent(target)}`, params: { monster_id: target } };
    }

    async function fetchManaFromBattle(monsterId, { logFn = console.log } = {}) {
        if (!monsterId) {
            const anyCard = document.querySelector('.monster-container .monster-card');
            monsterId = anyCard?.dataset?.monsterId;
        }
        if (!monsterId) {
            try {
                const resp = await fetch(PLAYER_STATS_URL, { credentials: 'same-origin' });
                if (resp.ok) {
                    const doc = new DOMParser().parseFromString(await resp.text(), 'text/html');
                    const any = doc.querySelector('.monster-container .monster-card');
                    monsterId = any?.dataset?.monsterId;
                }
            } catch (_) {}
        }
        if (!monsterId) return null;
        try {
            const response = await fetch(`${BATTLE_URL}?${battleTarget(monsterId).query}`, { credentials: 'same-origin' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return extractManaFromDoc(new DOMParser().parseFromString(await response.text(), 'text/html'));
        } catch (err) {
            console.error('Mana fetch failed', err);
            return null;
        }
    }
    /** Cast a class skill via damage.php. Returns parsed JSON response or null. */
    async function castClassSkill(monsterId, classSkill, { enableCalls = true, logFn = console.log } = {}) {
        if (!enableCalls) {
            logFn(`[SIMULATION] Cast ${classSkill.name} on ${monsterId}`);
            return { simulated: true };
        }
        const stamCost = classSkill.stamCost ?? 1;
        // v1.7 — monsterId may also be a dungeon target { instanceId, dgmid }
        const body = buildFormBody({ ...battleTarget(monsterId).params, skill_id: classSkill.id, stamina_cost: stamCost });
        try {
            const response = await fetch(DAMAGE_URL, {
                method: 'POST',
                headers: FORM_HEADERS,
                body,
                credentials: 'same-origin'
            });
            if (!response.ok && response.status !== 400) throw new Error(`HTTP ${response.status}`);
            return await response.json().catch(() => null);
        } catch (err) {
            logFn(`⚠️ [CLASS] Cast ${classSkill.name} failed on ${typeof monsterId === 'object' ? JSON.stringify(monsterId) : monsterId} (${err.message || err})`);
            console.error('Class skill cast failed:', err);
            return null;
        }
    }
    /* ====================================================================
       v1.4 — JUDGMENT SEAL DECISIONS — Pure
    ==================================================================== */
    /** Returns the active Judgment Seal config for the player's class, or null. */
    function getActiveJudgmentSeal(sharedSettings = {}) {
        if (!sharedSettings.judgmentSealEnabled) return null;
        const cls = sharedSettings.detectedClass;
        if (!cls || !CLASS_SKILLS[cls]) return null;
        return CLASS_SKILLS[cls].JUDGMENT_SEAL || null;
    }
    /** Decides whether Judgment Seal should be cast before a given skill. */
    function shouldCastJudgmentSeal(skillName, isBoss, sharedSettings = {}) {
        if (!getActiveJudgmentSeal(sharedSettings)) return false;
        if (!JUDGMENT_BOOSTABLE_SKILLS.has(skillName)) return false;
        const skillMatches =
            (skillName === 'LEGENDARY_SLASH'     && sharedSettings.judgmentSealForLegendary) ||
            (skillName === 'WORLD_BREAKER_SLASH' && sharedSettings.judgmentSealForWorldBreaker);
        if (!skillMatches) return false;
        return isBoss ? !!sharedSettings.judgmentSealForBosses : !!sharedSettings.judgmentSealForMonsters;
    }
    /* ====================================================================
       v1.4 — MANA MANAGER (stateful)
       Encapsule currentMana + counters + flags depleted.
       Usage :
         const mana = DSLib.createManaManager({
             getSharedSettings: () => settings.shared(),
             getMaxRefills:     () => settings.wave().maxManaRefills || 0,
             enableCalls:       true,
             logFn:             addLog,
             onUiUpdate:        () => updateUiStats(...),
         });
         await mana.refresh(monsterId);
         if (await mana.process()) { ... }
         await mana.castSeal(monsterId, seal);
    ==================================================================== */
    function createManaManager({
        maxMana = MAX_MANA,
        getSharedSettings = () => ({}),
        getMaxRefills    = () => 0,
        enableCalls      = true,
        logFn            = console.log,
        onUiUpdate       = () => {},
    } = {}) {
        let _current = 0;
        let _refillsUsed = 0;
        const _depleted = { S: false, L: false, F: false };

        async function refresh(monsterId) {
            const m = await fetchManaFromBattle(monsterId, { logFn });
            if (m && typeof m.current === 'number') {
                _current = m.current;
                try { onUiUpdate(_current); } catch (_) {}
                return m;
            }
            return null;
        }

        async function process() {
            if (_current >= maxMana) {
                logFn(`💠 [MANA] Already at max (${_current}/${maxMana}). Skipping.`);
                return false;
            }
            const sh = getSharedSettings() || {};
            const maxR = Number(getMaxRefills()) || 0;
            if (_refillsUsed >= maxR) {
                logFn(`🛑 [MANA] Max mana refills reached (${_refillsUsed}/${maxR}).`);
                return false;
            }
            // v1.7 — Full Mana Potion (useManaPotionF + fullManaPotionId).
            const POTS = {
                S: { allowed: !!sh.useManaPotionS && !_depleted.S && !!sh.manaPotionSId,    id: sh.manaPotionSId,    label: 'Mana Potion S' },
                L: { allowed: !!sh.useManaPotionL && !_depleted.L && !!sh.manaPotionLId,    id: sh.manaPotionLId,    label: 'Mana Potion L' },
                F: { allowed: !!sh.useManaPotionF && !_depleted.F && !!sh.fullManaPotionId, id: sh.fullManaPotionId, label: 'Full Mana Potion' },
            };
            const allowed = Object.keys(POTS).filter(k => POTS[k].allowed);
            if (!allowed.length) {
                logFn('🛑 [MANA] No mana potions allowed or available.');
                return false;
            }

            const opts = { enableCalls, logFn };
            const tryPot = async (kind) => {
                const ok = await useItemByInvId(POTS[kind].id, POTS[kind].label, opts);
                if (!ok) { logFn(`⚠️ [MANA] ${POTS[kind].label} depleted.`); _depleted[kind] = true; }
                return ok;
            };

            // Order: mana = 0 → biggest first (F, L, S); otherwise smallest
            // first (S, L, F) to avoid wasting a big potion. Falls back down
            // the list when a potion is depleted. (S/L only = historical rule:
            // L when mana = 0, else S.)
            const order = (_current === 0 ? ['F', 'L', 'S'] : ['S', 'L', 'F']).filter(k => allowed.includes(k));
            let success = false;
            for (let i = 0; i < order.length && !success; i++) {
                const k = order[i];
                if (i === 0) {
                    logFn(allowed.length === 1
                        ? `💠 [MANA] Consuming ${POTS[k].label} (only ${k} allowed)...`
                        : `💠 [MANA] Consuming ${POTS[k].label} (${_current === 0 ? 'mana = 0' : 'mana ' + _current})...`);
                } else {
                    logFn(`⚠️ [MANA] Falling back to ${k}.`);
                }
                success = await tryPot(k);
            }

            if (success) {
                _refillsUsed++;
                logFn(`💠 [MANA] Mana refilled. Total: ${_refillsUsed}/${maxR}.`);
            }
            return success;
        }

        async function castSeal(monsterId, seal) {
            const res = await castClassSkill(monsterId, seal, { enableCalls, logFn });
            if (res) {
                // v1.7 — the cost is only subtracted for a successful cast
                // (a rejected cast, e.g. "Not enough mana", costs nothing).
                if (typeof res.mana === 'number') _current = res.mana;
                else if (res.status === 'success' || res.simulated) _current = Math.max(0, _current - (seal.manaCost || 0));
                try { onUiUpdate(_current); } catch (_) {}
            }
            return res;
        }

        return {
            getCurrent:           () => _current,
            setCurrent:           (n) => { _current = Math.max(0, Number(n) || 0); try { onUiUpdate(_current); } catch (_) {} },
            getMax:               () => maxMana,
            getRefillsUsed:       () => _refillsUsed,
            isPotionSDepleted:    () => _depleted.S,
            isPotionLDepleted:    () => _depleted.L,
            isPotionFDepleted:    () => _depleted.F,   // v1.7
            resetCounters:        () => { _refillsUsed = 0; _depleted.S = _depleted.L = _depleted.F = false; },
            refresh,
            process,
            castSeal,
        };
    }
    /* ==================================================================== */
    /* ====================================================================
       v1.7 — HELPERS EXTRACTED FROM VEYRA 1.137
    ==================================================================== */

    /**
     * GET a page and parse it into a Document.
     *   throwOnError=false → returns null on network error / non-2xx.
     *   throwOnError=true  → throws Error('HTTP <status>') / the network error.
     *   noStore=true       → fetch option cache:'no-store'.
     *   withHtml=true      → returns { doc, html } instead of the Document.
     */
    async function fetchDoc(url, { throwOnError = false, noStore = false, withHtml = false } = {}) {
        try {
            const init = { credentials: 'same-origin' };
            if (noStore) init.cache = 'no-store';
            const r = await fetch(url, init);
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const html = await r.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            return withHtml ? { doc, html } : doc;
        } catch (err) {
            if (throwOnError) throw err;
            return null;
        }
    }

    /**
     * Temporarily sets a cookie while asyncFn runs, then restores the
     * previous value. If the cookie did not exist before, it is left set
     * (historical behaviour of every hide_dead_monsters toggle).
     */
    async function withCookie(name, value, asyncFn) {
        const original = getCookie(name);
        setCookie(name, value);
        try { return await asyncFn(); }
        finally { if (original !== null) setCookie(name, original); }
    }

    /** Countdown text: "2h 5m" (no seconds once hours > 0), "5m 12s", "12s". Rounds up. */
    function formatCountdown(ms) {
        if (!(ms > 0)) ms = 0;
        const totalSec = Math.ceil(ms / 1000);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        if (h > 0) return `${h}h ${m}m`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    }

    /**
     * Reads a JSON snapshot of session counters.
     * Returns { name: number|null } for each counter (toNonNeg, null if
     * absent/invalid) and { name: object|null } for each `objects` entry
     * (plain non-array object only). `aliases` = { name: legacyName } is
     * read when `name` is null/undefined in the snapshot.
     */
    function loadCounters(key, names = [], { objects = [], aliases = {}, storage = sessionStorage } = {}) {
        const out = {};
        names.forEach(n => { out[n] = null; });
        objects.forEach(n => { out[n] = null; });
        try {
            const raw = storage.getItem(key);
            if (!raw) return out;
            const saved = JSON.parse(raw);
            if (!saved || typeof saved !== 'object') return out;
            names.forEach(n => {
                let v = saved[n];
                if ((v === undefined || v === null) && aliases[n]) v = saved[aliases[n]];
                out[n] = toNonNeg(v);
            });
            objects.forEach(n => {
                const v = saved[n];
                if (v && typeof v === 'object' && !Array.isArray(v)) out[n] = v;
            });
        } catch (err) {
            console.error(`[DSLib] loadCounters(${key}) failed`, err);
        }
        return out;
    }
    function saveCounters(key, obj, { storage = sessionStorage } = {}) {
        try { storage.setItem(key, JSON.stringify(obj)); }
        catch (err) { console.error(`[DSLib] saveCounters(${key}) failed`, err); }
    }

    /** Tiny persistent JSON value: { load(), save(v), update(fn) }. Never throws. */
    function createJsonStore(key, { storage = localStorage, fallback = {} } = {}) {
        const clone = () => (fallback && typeof fallback === 'object') ? JSON.parse(JSON.stringify(fallback)) : fallback;
        const load = () => {
            try { const raw = storage.getItem(key); return raw ? JSON.parse(raw) : clone(); }
            catch (_) { return clone(); }
        };
        const save = (v) => { try { storage.setItem(key, JSON.stringify(v)); } catch (_) {} };
        return { load, save, update(fn) { const v = load(); const r = fn(v); save(r === undefined ? v : r); } };
    }

    /**
     * Typed log console rendered into #elementId (newest first by default).
     * Entries { ts, message, type } with type info|success|warn|error.
     * Safe to use before the element exists (render no-ops).
     */
    const LOG_TYPE_COLORS = { error: '#ff6b6b', success: '#69db7c', warn: '#fcc419', info: '#cdd6f4' };
    function createTypedLogBuffer({ elementId, max = 100, newestFirst = true, colors = LOG_TYPE_COLORS } = {}) {
        const entries = [];
        function render() {
            const box = elementId ? document.getElementById(elementId) : null;
            if (!box) return;
            const list = newestFirst ? entries.slice().reverse() : entries;
            box.innerHTML = list.map(l => {
                const color = colors[l.type] || colors.info;
                return `<div style="color:${color};font-size:11px;line-height:1.45"><span style="opacity:.55">${l.ts}</span> ${escapeHtml(l.message)}</div>`;
            }).join('');
        }
        return {
            add(message, type = 'info') {
                entries.push({ ts: now(), message, type });
                if (entries.length > max) entries.shift();
                render();
            },
            clear() { entries.length = 0; render(); },
            render,
            entries: () => entries.slice(),
        };
    }

    /**
     * Chained setTimeout scheduler (cycle → wait interval → cycle …).
     *   run({ isActive }) — the cycle; isActive() stays true while the
     *                       scheduler runs or during a runNow().
     *   onStart / onStop  — side effects (persist autoResume, logs…).
     * Unlike createIntervalLoop, the next cycle is armed only after the
     * previous one finished, getNextTickAt() is exposed, and a cycle is
     * never run twice concurrently (scheduled + runNow).
     */
    function createHourlyScheduler({ getIntervalMs, run, onStart = null, onStop = null } = {}) {
        if (typeof run !== 'function') throw new Error('[DSLib] createHourlyScheduler: run(fn) required');
        let running = false, timerId = null, nextTickAt = 0, inFlight = false, manual = false;
        const isActive = () => running || manual;

        async function runCycle(isManual) {
            if (inFlight) return false;
            inFlight = true; manual = !!isManual;
            try { await run({ isActive }); }
            finally { inFlight = false; manual = false; }
            return true;
        }
        function schedule(delayMs = getIntervalMs()) {
            if (timerId) clearTimeout(timerId);
            nextTickAt = Date.now() + delayMs;
            timerId = setTimeout(async () => {
                timerId = null;
                if (!running) return;
                try { await runCycle(false); }
                catch (e) { console.error('[DSLib] createHourlyScheduler: cycle error', e); }
                if (running) schedule();   // always re-armed, even after an error
            }, delayMs);
        }
        function start(delayMs = 0) {
            if (running) return;
            running = true;
            if (onStart) onStart();
            schedule(delayMs);
        }
        function stop() {
            if (!running && !timerId) return;
            running = false;
            if (timerId) { clearTimeout(timerId); timerId = null; }
            nextTickAt = 0;
            if (onStop) onStop();
        }
        return {
            start, stop,
            toggle() { if (running) stop(); else start(); return running; },
            reschedule() { if (running) schedule(); },
            runNow: () => runCycle(true),
            isRunning: () => running,
            isActive,
            isInFlight: () => inFlight,
            getNextTickAt: () => nextTickAt,
        };
    }

    /**
     * Drag & drop ordered list with an "Enabled" checkbox per row
     * (DOM/classes of Veyra's Wave Scan Order: .ds-wave-order-*).
     *   items       — array or () => array of { key, label, enabled }
     *   onToggle    — (key, checked)
     *   onReorder   — (draggedKey, targetKey); the list re-renders after it.
     */
    function renderOrderList(container, opts) {
        const { items, onToggle, onReorder, chkClass = 'ds-order-enable-chk',
                toggleTitle = 'Enable', toggleLabel = 'Enabled', dataAttr = 'orderKey' } = opts || {};
        if (!container) return;
        container.innerHTML = '';
        const list = (typeof items === 'function' ? items() : items) || [];
        const clearOver = (except) => container.querySelectorAll('.ds-wave-order-item').forEach(c => { if (c !== except) c.classList.remove('drag-over'); });
        list.forEach((it, idx) => {
            const key = it.key;
            const card = document.createElement('div');
            card.className = 'ds-wave-order-item';
            card.draggable = true;
            card.dataset[dataAttr] = key;
            card.innerHTML = `
                <span class="ds-wave-order-handle" title="Drag to reorder">☰</span>
                <span class="ds-wave-order-pos">#${idx + 1}</span>
                <span class="ds-wave-order-label">${it.label}</span>
                <label class="ds-wave-order-toggle" title="${escapeAttr(toggleTitle)}">
                    <input type="checkbox" class="${chkClass}" ${it.enabled ? 'checked' : ''}>
                    <span>${toggleLabel}</span>
                </label>
            `;
            const chk = card.querySelector('input[type="checkbox"]');
            chk.addEventListener('change', () => { if (onToggle) onToggle(key, chk.checked); });
            card.addEventListener('dragstart', (e) => {
                card.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', key);
            });
            card.addEventListener('dragend', () => { card.classList.remove('dragging'); clearOver(null); });
            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                clearOver(card);
                if (!card.classList.contains('dragging')) card.classList.add('drag-over');
            });
            card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
            card.addEventListener('drop', (e) => {
                e.preventDefault();
                const dragged = e.dataTransfer.getData('text/plain');
                if (!dragged || dragged === key) return;
                if (onReorder) onReorder(dragged, key);
                renderOrderList(container, opts);
            });
            container.appendChild(card);
        });
    }

    /**
     * Makes a fixed-position panel/modal draggable by a handle, with
     * position persisted in localStorage[storageKey].
     *   handle      — element, or null to pick the first of `handleCandidates`
     *                 (selectors / elements) found, else the element itself.
     *   clamp       — 'size' : keep the whole element on screen while dragging
     *                 {x,y}  : keep at least x/y px of it visible (default 100/50)
     *   cursor      — set cursor:move + user-select:none on the handle.
     *   clearTransform — drop a centering transform when positioned.
     */
    function makeElementDraggable(el, {
        handle = null, handleCandidates = [], storageKey = null,
        clamp = { x: 100, y: 50 }, cursor = true, clearTransform = true,
        ignoreSelector = 'input,button,select,textarea,a,label,[contenteditable]',
    } = {}) {
        if (!el || el.__dsDragBound) return;
        el.__dsDragBound = true;
        const anchor = () => {
            if (clearTransform) el.style.transform = 'none';
            el.style.right  = 'auto';
            el.style.bottom = 'auto';
        };
        if (storageKey) {
            try {
                const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
                if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
                    el.style.left = Math.min(saved.left, window.innerWidth  - 100) + 'px';
                    el.style.top  = Math.min(saved.top,  window.innerHeight - 50)  + 'px';
                    anchor();
                }
            } catch (_) {}
        }
        let h = handle;
        if (!h) {
            for (const c of handleCandidates) {
                const found = typeof c === 'string' ? el.querySelector(c) : c;
                if (found) { h = found; break; }
            }
        }
        h = h || el;
        if (cursor) { try { h.style.cursor = 'move'; h.style.userSelect = 'none'; } catch (_) {} }
        let drag = null;
        h.addEventListener('mousedown', (e) => {
            if (ignoreSelector && e.target.closest(ignoreSelector)) return;
            e.preventDefault();
            const rect = el.getBoundingClientRect();
            anchor();
            el.style.left = rect.left + 'px';
            el.style.top  = rect.top  + 'px';
            drag = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
        });
        document.addEventListener('mousemove', (e) => {
            if (!drag) return;
            const mx = clamp === 'size' ? el.offsetWidth  : (clamp.x ?? 100);
            const my = clamp === 'size' ? el.offsetHeight : (clamp.y ?? 50);
            const maxX = Math.max(0, window.innerWidth  - mx);
            const maxY = Math.max(0, window.innerHeight - my);
            el.style.left = Math.max(0, Math.min(maxX, e.clientX - drag.dx)) + 'px';
            el.style.top  = Math.max(0, Math.min(maxY, e.clientY - drag.dy)) + 'px';
        });
        document.addEventListener('mouseup', () => {
            if (!drag) return;
            drag = null;
            const left = parseInt(el.style.left, 10);
            const top  = parseInt(el.style.top,  10);
            if (storageKey && Number.isFinite(left) && Number.isFinite(top)) {
                try { localStorage.setItem(storageKey, JSON.stringify({ left, top })); } catch (_) {}
            }
        });
    }

    /* ====================================================================
       v1.5 — KILL SWITCH (Niveau 3 : manifest distant bloquant)
       Permet de désactiver à distance des versions de DSLib publiées,
       sans nécessiter une réinstallation des userscripts qui en dépendent.
       Le manifest est fetché au démarrage de la lib. Si la version courante
       est dans killedVersions OU si VERSION < minSupported, DSLib.ready
       résout avec { ok:false, reason }. Les scripts attendent DSLib.ready
       et refusent de démarrer en cas de kill.
       Offline / 404 → permissif (on ne casse pas tout le monde).
    ==================================================================== */
    const MANIFEST_URL = 'https://cdn.jsdelivr.net/gh/Niokhy/MDG-scripts@latest/manifest.json';
    function compareVersions(a, b) {
        const pa = String(a).split('.').map(n => parseInt(n, 10) || 0);
        const pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
            const da = pa[i] || 0, db = pb[i] || 0;
            if (da < db) return -1;
            if (da > db) return 1;
        }
        return 0;
    }
    const _ready = (async () => {
        try {
            const resp = await fetch(MANIFEST_URL, { cache: 'no-store', credentials: 'omit' });
            if (!resp.ok) {
                console.warn(`[DSLib] Manifest fetch HTTP ${resp.status} — staying permissive.`);
                return { ok: true, manifest: null };
            }
            const m = await resp.json();
            if (Array.isArray(m.killedVersions) && m.killedVersions.includes(VERSION)) {
                const reason = m.killMessage || `DSLib v${VERSION} has been retired by the publisher.`;
                console.error(`[DSLib] Killed (${VERSION}): ${reason}`);
                return { ok: false, reason, manifest: m };
            }
            if (m.minSupported && compareVersions(VERSION, m.minSupported) < 0) {
                const reason = m.killMessage || `Minimum supported DSLib version is ${m.minSupported} (current: ${VERSION}).`;
                console.error(`[DSLib] Min-support gate failed (${VERSION} < ${m.minSupported}): ${reason}`);
                return { ok: false, reason, manifest: m };
            }
            return { ok: true, manifest: m };
        } catch (e) {
            console.warn('[DSLib] Manifest fetch threw — staying permissive.', e);
            return { ok: true, manifest: null };
        }
    })();
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
        // v1.4 — Class & Mana
        MAX_MANA, CLASS_SKILLS, JUDGMENT_BOOSTABLE_SKILLS,
        CLASSES_URL, BATTLE_URL, DAMAGE_URL,
        extractManaFromDoc, fetchPlayerClass, fetchManaFromBattle, castClassSkill,
        getActiveJudgmentSeal, shouldCastJudgmentSeal,
        createManaManager,
        // v1.5 — Kill switch
        ready: _ready,
        compareVersions,
        MANIFEST_URL,
        // v1.6 — Stack support (Show unclaimed kills)
        getStackCount,
        sumStackCounts,
        pickCardsForCount,
        // v1.7 — Veyra 1.137 refactor helpers
        fetchInventoryPage, invalidateInventoryCache,
        fetchDoc, withCookie, formatCountdown,
        loadCounters, saveCounters, createJsonStore,
        createTypedLogBuffer, LOG_TYPE_COLORS,
        createHourlyScheduler, renderOrderList, makeElementDraggable,
        runHitLoop, HIT_LOOP_MSGS,
    };
})();
