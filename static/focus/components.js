/* UI enhancement only. The server returns every record, value and filter result. */
(() => {
    'use strict';

    const timers = new WeakMap();

    function cancel(form) {
        clearTimeout(timers.get(form));
        timers.delete(form);
    }

    function submit(form) {
        cancel(form);
        if (form.isConnected) form.requestSubmit();
    }

    document.addEventListener('input', event => {
        const input = event.target;
        if (!input.matches('form[data-live-filter] input[type=search]')) return;
        const form = input.form;
        cancel(form);
        timers.set(form, setTimeout(() => submit(form), 300));
    });

    document.addEventListener('change', event => {
        const field = event.target;
        const form = field.form;
        if (form?.matches('[data-live-filter]') && field.matches('select,input[type=date],input[type=checkbox]')) {
            submit(form);
        }
    });

    document.addEventListener('submit', event => {
        if (event.target.matches('[data-live-filter]')) cancel(event.target);
    });

    document.addEventListener('htmx:beforeRequest', event => {
        if (event.detail.target?.id === 'content') {
            document.getElementById('content')?.setAttribute('aria-busy', 'true');
        }
    });

    // Only the Sections tab uses these disclosure animations. Records stay in HTML.
    const sectionAnimations = new WeakMap();
    const sectionMotion = matchMedia('(prefers-reduced-motion: reduce)');

    function finishSection(section, open) {
        const state = sectionAnimations.get(section);
        if (state) {
            state.animation.onfinish = null;
            state.animation.cancel();
            sectionAnimations.delete(section);
        }
        section.open = open;
        section.querySelector('.cd-section-body')?.style.removeProperty('overflow');
    }

    function setSectionOpen(section, open, animate = true) {
        const body = section.querySelector('.cd-section-body');
        if (!body) return;
        const height = section.open ? body.getBoundingClientRect().height : 0;
        const opacity = section.open ? Number(getComputedStyle(body).opacity) : 0;
        const previous = sectionAnimations.get(section);
        if (previous) {
            previous.animation.onfinish = null;
            previous.animation.cancel();
            sectionAnimations.delete(section);
        }
        if (open) {
            for (const peer of section.parentElement.querySelectorAll('[data-course-section][open]')) {
                if (peer !== section) finishSection(peer, false);
            }
        }
        if (!animate || sectionMotion.matches || !body.animate) {
            finishSection(section, open);
            return;
        }
        section.open = true;
        body.style.overflow = 'hidden';
        const animation = body.animate([
            { height: `${height}px`, opacity },
            { height: `${open ? body.scrollHeight : 0}px`, opacity: open ? 1 : 0 }
        ], {
            duration: open ? 180 : 140,
            easing: 'cubic-bezier(.22,1,.36,1)',
            fill: 'both'
        });
        sectionAnimations.set(section, { animation, open });
        animation.onfinish = () => finishSection(section, open);
    }

    document.addEventListener('click', event => {
        const summary = event.target.closest(':is(#sections, .cd-general-materials) [data-course-section] > summary');
        if (!summary || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        const section = summary.parentElement;
        const state = sectionAnimations.get(section);
        setSectionOpen(section, !(state?.open ?? section.open));
    });

    function settleSections() {
        for (const section of document.querySelectorAll(':is(#sections, .cd-general-materials) [data-course-section]')) {
            const state = sectionAnimations.get(section);
            if (state) finishSection(section, state.open);
        }
    }

    for (const type of ['htmx:beforeHistorySave', 'htmx:beforeSwap']) {
        document.addEventListener(type, settleSections);
    }
    sectionMotion.addEventListener('change', settleSections);

    // Course-local glass indicator: the sidebar's spring constants and edge lag.
    // It only paints navigation chrome; panels and backend values stay untouched.
    let courseTabLens = null;
    const tabTransparency = matchMedia('(prefers-reduced-transparency: reduce)');
    const tabDataPreference = matchMedia('(prefers-reduced-data: reduce)');
    const tabForcedColors = matchMedia('(forced-colors: active)');

    function makeCourseTabLens(nav) {
        nav.querySelector(':scope > .cd-tab-lens')?.remove();
        nav.removeAttribute('data-tab-lens-ready');
        const lens = document.createElement('span');
        lens.className = 'cd-tab-lens';
        lens.setAttribute('aria-hidden', 'true');
        lens.inert = true;
        nav.append(lens);

        const keys = ['left', 'top', 'right', 'bottom'];
        const position = {}, velocity = {}, target = {};
        const reaction = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 };
        const events = new AbortController();
        let initialized = false, frame = 0, last = 0, started = 0;
        let leading = 'right', horizontal = true, lagUntil = 0, width = 0, height = 0;
        const flat = () => tabTransparency.matches || tabDataPreference.matches ||
            tabForcedColors.matches || navigator.connection?.saveData ||
            document.documentElement.dataset.effects === 'off';
        const canMove = () => !sectionMotion.matches && !flat();

        function paint() {
            const near = horizontal ? 'left' : 'top';
            const far = horizontal ? 'right' : 'bottom';
            const span = horizontal ? width : height;
            const wanted = span - target[near] - target[far];
            const actual = span - position[near] - position[far];
            const energy = Math.min(.8, Math.abs(actual - wanted) / Math.max(48, wanted));
            const waist = Math.min(2, energy * 4);
            const edges = {
                left: position.left + reaction.x + (horizontal ? 0 : waist),
                right: position.right - reaction.x + (horizontal ? 0 : waist),
                top: position.top + reaction.y + (horizontal ? waist : 0),
                bottom: position.bottom - reaction.y + (horizontal ? waist : 0)
            };
            for (const key of keys) {
                const limit = key === 'left' || key === 'right' ? width : height;
                lens.style.setProperty(`--tab-${key}`, `${Math.max(0, Math.min(limit, edges[key]))}px`);
            }
            lens.style.setProperty('--tab-energy', energy);
        }

        function snap() {
            cancelAnimationFrame(frame);
            frame = 0;
            last = 0;
            for (const key of keys) { position[key] = target[key]; velocity[key] = 0; }
            reaction.x = reaction.y = reaction.vx = reaction.vy = reaction.tx = reaction.ty = 0;
            lens.removeAttribute('data-flow');
            paint();
        }

        function tick(time) {
            frame = 0;
            if (!canMove() || document.hidden || !nav.isConnected) { snap(); return; }
            const dt = Math.min(.032, Math.max(.001, (time - (last || time - 16.67)) / 1000));
            last = time;
            let moving = false;
            for (const key of keys) {
                const main = horizontal ? key === 'left' || key === 'right' : key === 'top' || key === 'bottom';
                if (main && key !== leading && time < lagUntil) { moving = true; continue; }
                const stiffness = main ? (key === leading ? 340 : 210) : 300;
                const damping = main ? (key === leading ? 25 : 23) : 28;
                velocity[key] += (stiffness * (target[key] - position[key]) - damping * velocity[key]) * dt;
                position[key] += velocity[key] * dt;
                if (Math.abs(target[key] - position[key]) > .035 || Math.abs(velocity[key]) > .25) moving = true;
            }
            for (const [p, v, t] of [['x', 'vx', 'tx'], ['y', 'vy', 'ty']]) {
                reaction[v] += (280 * (reaction[t] - reaction[p]) - 24 * reaction[v]) * dt;
                reaction[p] += reaction[v] * dt;
                if (Math.abs(reaction[t] - reaction[p]) > .015 || Math.abs(reaction[v]) > .08) moving = true;
            }
            paint();
            if (moving && time - started < 1600) frame = requestAnimationFrame(tick);
            else {
                for (const key of keys) { position[key] = target[key]; velocity[key] = 0; }
                reaction.x = reaction.tx;
                reaction.y = reaction.ty;
                reaction.vx = reaction.vy = 0;
                paint();
                last = 0;
                lens.removeAttribute('data-flow');
            }
        }

        function wake() {
            if (!initialized) return;
            if (!canMove()) { snap(); return; }
            started = performance.now();
            if (!frame) { last = 0; frame = requestAnimationFrame(tick); }
        }

        function sync(instant = false) {
            nav.dataset.tabLensMode = flat() ? 'flat' : 'glass';
            const selected = nav.querySelector('[data-course-tab][aria-selected=true]');
            if (!selected || !nav.getClientRects().length) return;
            const rect = selected.getBoundingClientRect(), base = nav.getBoundingClientRect();
            const nextWidth = nav.clientWidth, nextHeight = nav.clientHeight;
            const left = rect.left - base.left - nav.clientLeft + nav.scrollLeft;
            const top = rect.top - base.top - nav.clientTop + nav.scrollTop;
            const next = { left, top, right: nextWidth - left - rect.width, bottom: nextHeight - top - rect.height };
            const resized = width !== nextWidth || height !== nextHeight;
            const changed = !initialized || keys.some(key => Math.abs(target[key] - next[key]) > .1);
            const dx = next.left - (target.left || 0), dy = next.top - (target.top || 0);
            width = nextWidth;
            height = nextHeight;
            Object.assign(target, next);
            if (!initialized || resized || !canMove()) {
                initialized = true;
                snap();
            } else if (changed) {
                horizontal = Math.abs(dx) >= Math.abs(dy);
                leading = horizontal ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'bottom' : 'top');
                if (instant) snap();
                else {
                    lens.dataset.flow = 'true';
                    lens.style.setProperty('--tab-spotlight', '0');
                    lagUntil = performance.now() + 32;
                    reaction.tx = reaction.ty = 0;
                    wake();
                }
            } else if (!frame && instant) paint();
            nav.dataset.tabLensReady = 'true';
        }

        function release() {
            lens.style.setProperty('--tab-spotlight', '0');
            nav.removeAttribute('data-tab-pressed');
            reaction.tx = reaction.ty = 0;
            if (Math.abs(reaction.x) + Math.abs(reaction.y) > .01) wake();
        }

        nav.addEventListener('pointermove', event => {
            if (event.pointerType === 'touch') return;
            if (flat()) { release(); return; }
            const tab = event.target.closest('[data-course-tab]');
            if (tab?.getAttribute('aria-selected') !== 'true') { release(); return; }
            const rect = tab.getBoundingClientRect();
            lens.style.setProperty('--tab-mx', `${event.clientX - rect.left}px`);
            lens.style.setProperty('--tab-my', `${event.clientY - rect.top}px`);
            lens.style.setProperty('--tab-spotlight', flat() || lens.hasAttribute('data-flow') ? '0' : '1');
            reaction.tx = canMove() ? ((event.clientX - rect.left) / rect.width - .5) * 5 : 0;
            reaction.ty = canMove() ? ((event.clientY - rect.top) / rect.height - .5) * 3 : 0;
            wake();
        }, { signal: events.signal });
        nav.addEventListener('pointerdown', event => {
            if (event.button === 0 && event.target.closest('[data-course-tab]')?.getAttribute('aria-selected') === 'true') {
                nav.dataset.tabPressed = 'true';
            }
        }, { signal: events.signal });
        for (const type of ['pointerleave', 'pointercancel', 'pointerup']) {
            nav.addEventListener(type, release, { signal: events.signal });
        }
        const resize = new ResizeObserver(() => sync(true));
        resize.observe(nav);
        for (const tab of nav.querySelectorAll('[data-course-tab]')) resize.observe(tab);
        sync(true);
        return {
            nav, sync, release,
            pause() { if (initialized) snap(); release(); },
            destroy() {
                cancelAnimationFrame(frame);
                resize.disconnect();
                events.abort();
                lens.remove();
                nav.removeAttribute('data-tab-lens-ready');
                nav.removeAttribute('data-tab-lens-mode');
                nav.removeAttribute('data-tab-pressed');
            }
        };
    }

    function syncTabLens(nav) {
        if (courseTabLens?.nav !== nav) {
            courseTabLens?.destroy();
            courseTabLens = nav ? makeCourseTabLens(nav) : null;
        }
        courseTabLens?.sync();
    }

    for (const preference of [sectionMotion, tabTransparency, tabDataPreference, tabForcedColors]) {
        preference.addEventListener('change', () => courseTabLens?.sync(true));
    }
    document.fonts?.ready.then(() => courseTabLens?.sync(true));
    navigator.connection?.addEventListener?.('change', () => courseTabLens?.sync(true));
    window.addEventListener('blur', () => courseTabLens?.release());
    document.addEventListener('visibilitychange', () => { if (document.hidden) courseTabLens?.pause(); });
    document.addEventListener('htmx:beforeSwap', event => {
        if (event.detail.target?.id === 'content') { courseTabLens?.destroy(); courseTabLens = null; }
    });
    new MutationObserver(() => courseTabLens?.sync(true)).observe(document.documentElement, {
        attributes: true, attributeFilter: ['data-theme', 'data-effects']
    });

    function selectCourseTab(tablist, selected, focus = false) {
        for (const tab of tablist.querySelectorAll('[data-course-tab]')) {
            const active = tab.dataset.courseTab === selected;
            tab.setAttribute('aria-selected', String(active));
            tab.tabIndex = active ? 0 : -1;
            const panel = document.getElementById(tab.getAttribute('aria-controls'));
            if (panel) panel.hidden = !active;
            if (active && focus) tab.focus({ preventScroll: true });
        }
        syncTabLens(tablist);
    }

    function syncCourseTabs() {
        const tablist = document.querySelector('[data-course-tabs]');
        if (!tablist) { syncTabLens(null); return; }
        let hash = '';
        try {
            hash = decodeURIComponent(location.hash.slice(1));
        } catch {}
        const target = document.getElementById(hash);
        const requested = target?.closest('[role=tabpanel]')?.id || hash || new URLSearchParams(location.search).get('tab');
        const name = requested === 'files' ? 'sections' : requested;
        const tabs = [...tablist.querySelectorAll('[data-course-tab]')];
        const selected = tabs.some(tab => tab.dataset.courseTab === name) ? name : 'overview';
        selectCourseTab(tablist, selected);
        // Deep links and review responses can reopen the relevant native dropdown.
        if (target?.closest('[role=tabpanel]')?.id === selected) {
            const dropdown = target.closest('details');
            const section = target.closest('[data-course-section]');
            if (section) setSectionOpen(section, true, false);
            if (dropdown && dropdown !== section) dropdown.open = true;
        }
    }

    function activateCourseTab(tab, focus = false) {
        const tablist = tab.closest('[data-course-tabs]');
        const selected = tab.dataset.courseTab;
        selectCourseTab(tablist, selected, focus);
        const url = new URL(location.href);
        url.searchParams.set('tab', selected);
        url.hash = selected;
        // Keep the page's existing HTMX history entry; switching tabs fetches no data.
        history.replaceState(history.state, '', url);
        const bounds = tab.getBoundingClientRect();
        const frame = tablist.getBoundingClientRect();
        if (bounds.left < frame.left) tablist.scrollLeft -= frame.left - bounds.left;
        else if (bounds.right > frame.right) tablist.scrollLeft += bounds.right - frame.right;
    }

    document.addEventListener('click', event => {
        const tab = event.target.closest('[data-course-tab]');
        if (!tab || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        activateCourseTab(tab);
    });

    document.addEventListener('keydown', event => {
        const tab = event.target.closest('[data-course-tab]');
        if (!tab) return;
        if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            activateCourseTab(tab, true);
            return;
        }
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        const tabs = [...tab.closest('[data-course-tabs]').querySelectorAll('[data-course-tab]')];
        const index = tabs.indexOf(tab);
        let next;
        if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = tabs.length - 1;
        else next = (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        event.preventDefault();
        activateCourseTab(tabs[next], true);
    });

    function anchorState() {
        syncCourseTabs();
        for (const nav of document.querySelectorAll('.server-views:not([data-course-tabs])')) {
            const links = [...nav.querySelectorAll('a[href^="#"]')];
            if (!links.length) continue;
            const selected = location.hash || links[0].hash;
            for (const link of links) {
                if (link.hash === selected) link.setAttribute('aria-current', 'location');
                else link.removeAttribute('aria-current');
            }
        }
    }

    window.addEventListener('hashchange', anchorState);
    for (const type of ['htmx:afterSwap', 'htmx:afterSettle', 'htmx:historyRestore']) {
        document.addEventListener(type, anchorState);
    }
    anchorState();

    function ready() {
        document.getElementById('content')?.removeAttribute('aria-busy');
    }

    for (const type of ['htmx:afterRequest', 'htmx:responseError', 'htmx:sendError']) {
        document.addEventListener(type, ready);
    }
})();
