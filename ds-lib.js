// ==UserScript==
// @name         DSLib — Shared utilities for Demonicscans automators
// @namespace    demonicscans-lib
// @version      1.0
// @description  Shared constants, utilities, CSS and API helpers for DS automator scripts
// @author       Niokhy
// ==/UserScript==

/**
 * DSLib — exposed as a global so any @require-ing script can use it.
 *
 * Usage in another script's header:
 *   // @require  file:///C:/path/to/ds-lib.js
 *   // @require  https://cdn.jsdelivr.net/gh/your-user/your-repo@1.0/ds-lib.js
 *
 * Then in the script body:
 *   const { SKILLS, getCookie, handleStaminaLogic, ... } = DSLib;
 */
const DSLib = (() => {
    'use strict';

    /* ====================================================================
       VERSION
       Bump this string every time ds-lib.js changes in a breaking way.
       Scripts that declare a different REQUIRED_DSLIB_VERSION will
       refuse to start, forcing the user to update all scripts together.
    ==================================================================== */

    const VERSION = '1.0';

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
       Uses the v2.1 selectors from Dungeon Automator (most up-to-date).
       Falls back to Wave Automator selectors so both scripts stay compatible.
    ==================================================================== */

    /**
     * Parse HP, stamina and EXP from a DOMParser document fetched from
     * active_wave.php (or any page that renders the player sidebar).
     *
     * Returns { hp: number|null, stamina: number|null, exp: { current, max, ratio }|null }
     */
    function extractPlayerStatsFromDoc(doc) {
        // --- HP (v2.1 selector first, legacy fallback second) ---
        let hp = null;
        const hpEl = doc.querySelector('.playerhp .muted')
                  || doc.querySelector('.player-resources .res-row .res-meta');
        if (hpEl) {
            const val = parseInt(hpEl.textContent.trim().split('/')[0].replace(/,/g, ''), 10);
            if (!Number.isNaN(val)) hp = val;
        }

        // --- Stamina ---
        let stamina = null;
        const stamEl = doc.getElementById('stamina_span');
        if (stamEl) {
            const val = parseInt(stamEl.textContent.trim().replace(/,/g, ''), 10);
            if (!Number.isNaN(val)) stamina = val;
        }

        // --- EXP ---
        // .gtb-exp-top renders two spans: ["EXP", "19,875,316 / 76,956,856"]
        // Using the LAST span works for both scripts: when there are exactly 2 spans
        // last === nth-child(2); if the DOM ever adds more spans, last is still the value.
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

    /**
     * Fetch player stats from the reference wave page.
     * Returns the same shape as extractPlayerStatsFromDoc, or null on error.
     */
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

    /* ====================================================================
       INVENTORY ID AUTO-FETCHER
       Fetches /inventory.php, finds known potion cards and fires a callback
       so each script can update its own storage.

       @param {object} options
         onUpdate(potionName, invId) — called for each recognised potion;
           should return true if the value actually changed (used to decide
           whether to log the "auto-updated" message).
         logFn(msg) — defaults to console.log
    ==================================================================== */

    const POTION_NAMES = new Set([
        'Full Stamina Potion',
        'Large Stamina Potion',
        'Full Hp Potion',
        'Small Stamina Potion'
    ]);

    async function fetchInventoryIds({ onUpdate, logFn = console.log } = {}) {
        try {
            const response = await fetch(INVENTORY_URL, { credentials: 'same-origin' });
            if (!response.ok) return;
            const doc = new DOMParser().parseFromString(await response.text(), 'text/html');

            let anyUpdated = false;
            doc.querySelectorAll('.potion-card').forEach(card => {
                const nameNode = card.querySelector('.potion-name span');
                if (!nameNode) return;
                const rawName = nameNode.textContent.trim();
                if (!POTION_NAMES.has(rawName)) return;
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
       POTION USAGE
    ==================================================================== */

    /**
     * Use a stamina potion from the inventory by its inv_id.
     *
     * @param {number} invId
     * @param {string} label      — display name for logs ("Large Stamina Potion", …)
     * @param {object} [opts]
     *   enableCalls {bool}   — false = simulation mode, no real request sent
     *   logFn {function}     — logging callback
     *
     * @returns {Promise<boolean>} true if the potion was consumed, false if not usable.
     */
    async function useStaminaPotion(invId, label, { enableCalls = true, logFn = console.log } = {}) {
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

    /**
     * Use an HP potion.
     *
     * @param {object} opts
     *   hpPotionId     {number}
     *   enableHpPotion {bool}     — false = skip (HP potions disabled in settings)
     *   enableCalls    {bool}     — false = simulation mode
     *   logFn          {function}
     */
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
       Unified SSP gap-fill → LSP → FSP → SSP plain sequence,
       identical to what both automators implement separately today.

       Accepts a context object; returns an update object that the caller
       should merge back into its own state variables.

       --- Context fields ---

       Config (read-only):
         enableCalls          {bool}    simulation guard
         expThreshold         {number}  ratio 0–1 above which refills stop
         maxStaminaRefills    {number}  max LSP/FSP uses per session
         staminaThreshold     {number}  stamina value to fill up to
         sspMinThreshold      {number}  SSP gap-fill only fires when currentStamina > this
         maxSspRefills        {number}  max SSP uses per session
         sspFillGap           {bool}    enable SSP gap-fill mode
         enableSsp            {bool}    enable plain SSP refill mode
         useLargeStamina      {bool}
         useFullStamina       {bool}
         smallStaminaPotionId {number}
         largeStaminaPotionId {number}
         fullStaminaPotionId  {number}
         running              {bool}    set to false to abort the inner SSP loop

       Current state:
         currentExpRatio      {number}  0–1
         currentStamina       {number}
         staminaRefillsUsed   {number}
         sspRefillsUsed       {number}
         largePotionsDepleted {bool}

       Callbacks:
         logFn(msg)           — logging function
         persistStatsFn()     — called after each counter increment so the
                                caller's sessionStorage / state stays in sync

       --- Return value ---
       {
         success:             bool    — true if at least one potion was consumed
         currentStamina:      number,
         staminaRefillsUsed:  number,
         sspRefillsUsed:      number,
         largePotionsDepleted: bool
       }
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

        // Mutable copies of the state values we may update
        let currentStamina       = ctx.currentStamina       ?? 0;
        let staminaRefillsUsed   = ctx.staminaRefillsUsed   ?? 0;
        let sspRefillsUsed       = ctx.sspRefillsUsed       ?? 0;
        let largePotionsDepleted = ctx.largePotionsDepleted ?? false;

        const ret = () => ({ success, currentStamina, staminaRefillsUsed, sspRefillsUsed, largePotionsDepleted });
        let success = false;

        // --- Guards ---
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

        // 1. SSP gap-fill: loop until stamina reaches threshold or SSP cap is hit
        if (!success && sspFillGap && sspRefillsUsed < maxSspRefills && smallStaminaPotionId) {
            if (currentStamina > sspMinThreshold) {
                logFn(`🧪 SSP gap-fill: stamina ${currentStamina} > min ${sspMinThreshold}. Filling toward ${staminaThreshold}…`);
                while (currentStamina < staminaThreshold && sspRefillsUsed < maxSspRefills && running) {
                    const ok = await useStaminaPotion(smallStaminaPotionId, 'Small Stamina Potion', opts);
                    if (!ok) { logFn('⚠️ Out of Small Stamina Potions.'); break; }
                    sspRefillsUsed++;
                    currentStamina += 20; // ~20 stamina per SSP
                    persistStatsFn();
                    logFn(`⚡ SSP used (${sspRefillsUsed}/${maxSspRefills}). Stamina ~${currentStamina}.`);
                }
                success = currentStamina >= staminaThreshold;
            } else {
                logFn(`⏭️ SSP gap-fill skipped: stamina ${currentStamina} ≤ min ${sspMinThreshold}. Trying LSP/FSP.`);
            }
        }

        // 2. Large Stamina Potion
        if (!success && useLargeStamina && !largePotionsDepleted) {
            logFn('🧪 Consuming Large Stamina Potion…');
            success = await useStaminaPotion(largeStaminaPotionId, 'Large Stamina Potion', opts);
            if (!success) {
                logFn('⚠️ Out of Large Stamina Potions. Marking as depleted.');
                largePotionsDepleted = true;
            }
        }

        // 3. Full Stamina Potion
        if (!success && useFullStamina) {
            logFn('🧪 Consuming Full Stamina Potion…');
            success = await useStaminaPotion(fullStaminaPotionId, 'Full Stamina Potion', opts);
        }

        // 4. Plain SSP (no gap-fill)
        if (!success && enableSsp && sspRefillsUsed < maxSspRefills && smallStaminaPotionId) {
            logFn('🧪 Consuming Small Stamina Potion…');
            const ok = await useStaminaPotion(smallStaminaPotionId, 'Small Stamina Potion', opts);
            if (ok) {
                sspRefillsUsed++;
                persistStatsFn();
                logFn(`🧪 SSP used. Total: ${sspRefillsUsed}/${maxSspRefills}`);
                success = true;
            }
        }

        if (success) {
            staminaRefillsUsed++;
            persistStatsFn();
            logFn(`⚡ Stamina Refilled. Total LSP/FSP used: ${staminaRefillsUsed}/${maxStaminaRefills}`);
        } else {
            logFn('⚠️ No usable Stamina Potions found.');
        }

        return ret();
    }

    /* ====================================================================
       LOOT TRACKING
    ==================================================================== */

    /**
     * Merge an API loot items array into a lootTracker dictionary.
     * Handles both field naming conventions used by the two scripts:
     *   upper-case  { ITEM_ID, NAME, IMAGE_URL, TIER }
     *   lower-case  { id, name, image, tier }
     *
     * @param {Array}  items       — raw items array from the loot API response
     * @param {Object} lootTracker — mutated in-place: { [itemId]: { count, name, img, tier } }
     */
    function processLootItems(items, lootTracker) {
        if (!items || !Array.isArray(items)) return;
        items.forEach(item => {
            const id = item.ITEM_ID || item.id;
            if (!id) return;
            if (!lootTracker[id]) {
                lootTracker[id] = {
                    count: 0,
                    name:  item.NAME      || item.name  || 'Unknown Item',
                    img:   item.IMAGE_URL || item.image || '',
                    tier:  item.TIER      || item.tier  || 'COMMON'
                };
            }
            lootTracker[id].count++;
        });
    }

    /**
     * Build the inner HTML string for a .ds-loot-grid container from a lootTracker.
     *
     * @param {Object} lootTracker — { [itemId]: { count, name, img, tier } }
     * @param {string} [baseUrl]   — base URL for image paths (default: BASE_URL)
     * @returns {string} HTML string ready to set as innerHTML
     */
    function buildLootGridHTML(lootTracker, baseUrl = BASE_URL) {
        const itemIds = Object.keys(lootTracker);
        if (itemIds.length === 0) {
            return '<div class="ds-empty-loot">No items looted this session yet.</div>';
        }
        return itemIds.map(id => {
            const item = lootTracker[id];
            const tier = (item.tier || 'COMMON').toUpperCase();
            const ts   = TIER_STYLES[tier] || TIER_STYLES.COMMON;
            // Normalise image path: strip leading slash, then prefix base URL
            const cleanPath = item.img.startsWith('/') ? item.img.substring(1) : item.img;
            const imgUrl    = cleanPath.startsWith('http') ? cleanPath : `${baseUrl}/${cleanPath}`;
            return `<div class="ds-item-card" title="${item.name} (${item.tier})" style="border-color:${ts.border}; box-shadow:${ts.glow};">
                        <img src="${imgUrl}" class="ds-item-img" alt="${item.name}">
                        <div class="ds-item-count">x${item.count}</div>
                    </div>`;
        }).join('');
    }

    /* ====================================================================
       PUBLIC API
    ==================================================================== */

    return {
        // Version
        VERSION,

        // Constants
        SKILLS, STATUS_COLORS, TIER_STYLES, POTION_NAMES,
        BASE_URL, USE_ITEM_URL, HP_POT_URL, INVENTORY_URL, PLAYER_STATS_URL, FORM_HEADERS,

        // Utilities
        getCookie, setCookie, now, sleep, rand,
        buildFormBody, postForm, parseDamageCap,

        // CSS
        injectBaseCSS,

        // Player stats
        extractPlayerStatsFromDoc, getPlayerStatsFromWave,

        // Inventory
        fetchInventoryIds,

        // Potions
        useStaminaPotion, refillHp, handleStaminaLogic,

        // Loot
        processLootItems, buildLootGridHTML
    };
})();
