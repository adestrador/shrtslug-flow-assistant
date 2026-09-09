// ==UserScript==
// @name         Shrtslug Flow Assistant
// @name:pt-BR   Assistente de Fluxo Shrtslug
// @namespace    https://github.com/adestrador/shrtslug-flow-assistant
// @version      1.2.0
// @description  Automates repetitive steps on supported Shrtslug flow pages, waits for site timers, and pauses for manual CAPTCHA verification.
// @description:pt-BR Automatiza etapas repetitivas do fluxo Shrtslug nos domínios compatíveis, aguarda os temporizadores do site e pausa para verificação manual de CAPTCHA.
// @author       tigerwong
// @homepageURL  https://github.com/adestrador/shrtslug-flow-assistant
// @supportURL   https://github.com/adestrador/shrtslug-flow-assistant/issues
// @license      MIT
// @match        https://shrtslug.biz/*
// @match        https://*.shrtslug.biz/*
// @match        https://digiztechno.com/*
// @match        https://*.digiztechno.com/*
// @match        https://tournguide.com/*
// @match        https://*.tournguide.com/*
// @match        https://yrtourguide.com/*
// @match        https://*.yrtourguide.com/*
// @match        https://techmize.net/*
// @match        https://*.techmize.net/*
// @match        https://technons.com/*
// @match        https://*.technons.com/*
// @match        https://biovetro.net/*
// @match        https://*.biovetro.net/*
// @match        https://dailyjobposting.xyz/*
// @match        https://*.dailyjobposting.xyz/*
// @match        https://financefernly.com/*
// @match        https://*.financefernly.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

    const PREFIX = '[Shrtslug Auto]';
    const SUBMITTED = 'shrtslugAutoSubmitted';
    const CLICKED = 'shrtslugAutoClicked';
    const AUTO_CLICK_DELAY_MS = 650;
    const SAME_ACTION_COOLDOWN_MS = 4000;
    const MAX_AUTO_CLICKS_PER_PAGE = 8;

    const STEP_MARKERS = [
        'buy subscription remove ads and steps',
        'click the button below to start',
        'please wait and click the button to verify',
        'clique no botao abaixo para comecar',
        'aguarde e clique no botao para verificar'
    ];

    const ACTION_PATTERNS = [
        /^(abrir|open|start|iniciar|comecar)$/,
        /^(clique (aqui )?(na|sobre a) imagem|click (here )?(on )?(the )?image)$/,
        /^(clique aqui para verificar|click here to verify|verificar|verify)$/,
        /^(continuar|continue|prosseguir|next|proximo|avancar)$/,
        /^(obter link|get link|go to link|ir para o link|acessar link)$/
    ];

    let statusBadge;
    let autoClickCount = 0;
    let tickQueued = false;
    let lastStepPageCheck = 0;
    let cachedStepPage = false;
    let manualButton = null;

    const visibleSince = new WeakMap();
    const recentClicks = new Map();

    function log(...args) {
        console.info(PREFIX, ...args);
    }

    function normalizeText(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[↓↑→←]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    function setStatus(message, kind = 'working') {
        if (!document.body) return;

        if (!statusBadge || !statusBadge.isConnected) {
            statusBadge = document.createElement('div');
            statusBadge.id = 'shrtslug-auto-status';
            document.body.appendChild(statusBadge);
        }

        statusBadge.dataset.kind = kind;
        statusBadge.textContent = message;
    }

    function installStyles() {
        if (!document.documentElement || document.getElementById('shrtslug-auto-style')) return;

        const style = document.createElement('style');
        style.id = 'shrtslug-auto-style';
        style.textContent = `
            #shrtslug-auto-status {
                position: fixed !important;
                right: 12px !important;
                bottom: 12px !important;
                z-index: 2147483647 !important;
                max-width: min(390px, calc(100vw - 24px)) !important;
                padding: 10px 14px !important;
                border: 1px solid rgba(255,255,255,.25) !important;
                border-radius: 10px !important;
                background: #17365d !important;
                color: #fff !important;
                box-shadow: 0 4px 18px rgba(0,0,0,.3) !important;
                font: 600 14px/1.35 system-ui, sans-serif !important;
            }
            #shrtslug-auto-status[data-kind="waiting"] {
                background: #7a4c00 !important;
            }
            #shrtslug-auto-status[data-kind="ready"] {
                background: #12663a !important;
            }
            #shrtslug-auto-status[data-kind="error"] {
                background: #8b1e2d !important;
            }
            #main_area {
                display: block !important;
            }
        `;
        document.documentElement.appendChild(style);
    }

    function isVisible(element) {
        if (!(element instanceof Element) || !element.isConnected) return false;

        const style = getComputedStyle(element);
        if (
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            style.visibility === 'collapse' ||
            Number(style.opacity) === 0
        ) {
            return false;
        }

        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function isDisabled(element) {
        return Boolean(
            element.disabled ||
            element.getAttribute('aria-disabled') === 'true' ||
            element.classList.contains('disabled')
        );
    }

    function suppressAntiAdblock() {
        const main = document.getElementById('main_area');
        if (main) {
            main.style.setProperty('display', 'block', 'important');
        }

        document.querySelectorAll('[data-action="recheck"], [data-action="reload"]').forEach((control) => {
            const overlay = control.closest('[id]');
            if (
                overlay &&
                overlay !== document.body &&
                overlay !== document.documentElement &&
                overlay.id !== 'main_area'
            ) {
                overlay.style.setProperty('display', 'none', 'important');
                overlay.classList.add('hidden');
            }
        });

        document.body?.style.removeProperty('overflow');
    }

    function requestSubmit(form, button, label) {
        if (!form || form.dataset[SUBMITTED] === '1') return false;

        form.dataset[SUBMITTED] = '1';
        setStatus(label || 'Avançando automaticamente…');
        log(label || 'Submitting form', form.action || location.href);

        try {
            if (typeof form.requestSubmit === 'function') {
                form.requestSubmit(button || undefined);
            } else if (button) {
                button.click();
            } else {
                form.submit();
            }
            return true;
        } catch (error) {
            form.dataset[SUBMITTED] = '0';
            setStatus('Não foi possível avançar automaticamente.', 'error');
            console.error(PREFIX, error);
            return false;
        }
    }

    function exposeCaptcha(form) {
        if (!form.id) return;

        const startArea = document.getElementById(`${form.id}_start_area`);
        const captchaArea = document.getElementById(`${form.id}_area`);

        if (startArea) startArea.classList.add('hidden');
        if (captchaArea) captchaArea.classList.remove('hidden');

        const widget = form.querySelector('.cf-turnstile');
        if (!widget || widget.querySelector('iframe')) return;

        const now = Date.now();
        const lastAttempt = Number(widget.dataset.shrtslugRenderAttempt || 0);
        if (now - lastAttempt < 1500) return;
        widget.dataset.shrtslugRenderAttempt = String(now);

        try {
            const turnstileApi = window.turnstile || window.cf?.turnstile;
            if (typeof turnstileApi?.render === 'function') {
                turnstileApi.render(widget);
            }
        } catch (error) {
            log('Turnstile ainda não está pronto.', error);
        }
    }

    function captchaToken(scope = document) {
        const selectors = [
            'input[name="cf-turnstile-response"]',
            'textarea[name="cf-turnstile-response"]',
            'textarea[name="g-recaptcha-response"]',
            'input[name="h-captcha-response"]',
            'textarea[name="h-captcha-response"]'
        ];

        for (const selector of selectors) {
            const field = scope.querySelector(selector);
            if (field?.value?.trim().length > 10) return field.value.trim();
        }

        return '';
    }

    function visibleCaptchaWidget() {
        const selectors = [
            '.cf-turnstile',
            '.g-recaptcha',
            '.h-captcha',
            'iframe[src*="challenges.cloudflare.com"]',
            'iframe[src*="recaptcha"]',
            'iframe[src*="hcaptcha"]'
        ];

        for (const selector of selectors) {
            for (const element of document.querySelectorAll(selector)) {
                if (isVisible(element) && !captchaToken(element.closest('form') || document)) {
                    return element;
                }
            }
        }

        return null;
    }

    function processVerificationForms() {
        const forms = document.querySelectorAll('form[action*="/api-endpoint/verify"]');

        for (const form of forms) {
            if (form.dataset[SUBMITTED] === '1') continue;

            const action = normalizeText(form.querySelector('input[name="action"]')?.value);
            const button = form.querySelector('button[type="submit"], input[type="submit"]');

            if (action === 'human-verification') {
                requestSubmit(form, button, 'Verificação inicial concluída; avançando…');
                return 'submitted';
            }

            if (action === 'captcha') {
                exposeCaptcha(form);

                if (captchaToken(form)) {
                    requestSubmit(form, button, 'Verificação reconhecida; avançando…');
                    return 'submitted';
                }

                const widget = form.querySelector('.cf-turnstile, .g-recaptcha, .h-captcha');
                const hasFrame = Boolean(widget?.querySelector('iframe'));
                setStatus(
                    hasFrame
                        ? 'Resolva a verificação humana; depois o avanço será automático.'
                        : 'Carregando a verificação humana…',
                    'waiting'
                );
                return 'waiting';
            }
        }

        return 'none';
    }

    function processSpeedTokenForms() {
        const tokens = document.querySelectorAll(
            'form:not([action*="/api-endpoint/verify"]) input[name="speed_token"]'
        );

        for (const token of tokens) {
            const form = token.form;
            if (!form || form.dataset[SUBMITTED] === '1') continue;
            if (!token.value?.trim()) continue;

            const button = form.querySelector('button[type="submit"], input[type="submit"]');
            if (button && (!isVisible(button) || isDisabled(button))) continue;

            if (requestSubmit(form, button, 'Etapa concluída; abrindo a próxima…')) {
                return true;
            }
        }

        return false;
    }

    function processVisibleFinalLinks() {
        const panels = document.querySelectorAll('[id$="_final"]:not(.hidden)');

        for (const panel of panels) {
            if (!isVisible(panel)) continue;

            const directLink = panel.querySelector('a[href^="http"]');
            if (!directLink) continue;

            const href = directLink.href;
            if (!href || /(?:premium-access|subscription|remove-ads)/i.test(href)) continue;

            setStatus('Abrindo o endereço final…', 'ready');
            log('Final link', href);
            window.location.assign(href);
            return true;
        }

        return false;
    }

    function looksLikeStepPage() {
        const now = Date.now();
        if (now - lastStepPageCheck < 800) return cachedStepPage;
        lastStepPageCheck = now;

        if (
            document.querySelector(
                'input[name="speed_token"], form[action*="/api-endpoint/verify"], [id$="_start_area"], [id$="_final"]'
            )
        ) {
            cachedStepPage = true;
            return true;
        }

        const bodyText = normalizeText((document.body?.innerText || '').slice(0, 80000));
        cachedStepPage = STEP_MARKERS.some((marker) => bodyText.includes(marker));
        return cachedStepPage;
    }

    function clickableLabel(element) {
        const imageAlt = element.querySelector?.('img[alt]')?.getAttribute('alt');
        return normalizeText(
            element.getAttribute('aria-label') ||
            element.getAttribute('title') ||
            element.value ||
            element.innerText ||
            element.textContent ||
            imageAlt
        );
    }

    function isKnownAction(label) {
        return ACTION_PATTERNS.some((pattern) => pattern.test(label));
    }

    function isPremiumControl(element, label) {
        const href = element.getAttribute('href') || '';
        const combined = `${label} ${normalizeText(href)}`;
        return /premium|subscription|remove ads|remover anuncios|account/.test(combined);
    }

    function actionScore(element) {
        let score = 0;
        if (element.closest('form')) score += 5;

        const identity = normalizeText(
            `${element.id || ''} ${element.className || ''} ${element.closest('[id]')?.id || ''}`
        );
        if (/step|short|verify|captcha|start|continue|link/.test(identity)) score += 3;

        let parent = element.parentElement;
        for (let depth = 0; parent && depth < 4; depth += 1, parent = parent.parentElement) {
            const text = normalizeText((parent.innerText || '').slice(0, 2500));
            if (STEP_MARKERS.some((marker) => text.includes(marker))) {
                score += 10 - depth;
                break;
            }
        }

        return score;
    }

    function findActionButton() {
        const candidates = [];
        const selector = 'button, input[type="button"], input[type="submit"], a, [role="button"]';

        for (const element of document.querySelectorAll(selector)) {
            if (element.id === 'shrtslug-auto-status') continue;
            if (element.dataset[CLICKED] === '1') continue;
            if (element.closest('form')?.dataset[SUBMITTED] === '1') continue;
            if (!isVisible(element) || isDisabled(element)) continue;

            const label = clickableLabel(element);
            if (!label || !isKnownAction(label) || isPremiumControl(element, label)) continue;

            candidates.push({ element, label, score: actionScore(element) });
        }

        candidates.sort((a, b) => b.score - a.score);
        return candidates[0] || null;
    }

    function automaticClick(candidate) {
        const { element, label } = candidate;
        const now = Date.now();
        const firstSeen = visibleSince.get(element);

        if (!firstSeen) {
            visibleSince.set(element, now);
            setStatus(`Ação encontrada: “${element.innerText?.trim() || element.value || label}”.`);
            return true;
        }

        if (now - firstSeen < AUTO_CLICK_DELAY_MS) return true;

        if (autoClickCount >= MAX_AUTO_CLICKS_PER_PAGE) {
            setStatus('Limite de segurança atingido; prossiga manualmente nesta página.', 'waiting');
            return true;
        }

        const signature = `${location.href}|${label}|${element.getAttribute('href') || ''}`;
        const lastClick = recentClicks.get(signature) || 0;
        if (now - lastClick < SAME_ACTION_COOLDOWN_MS) return true;

        recentClicks.set(signature, now);
        element.dataset[CLICKED] = '1';
        autoClickCount += 1;

        setStatus(
            `Clicando automaticamente: “${element.innerText?.trim() || element.value || label}”…`
        );
        log('Automatic click', { label, element });

        try {
            const oldUrl = location.href;
            element.click();

            setTimeout(() => {
                if (
                    location.href === oldUrl &&
                    element.isConnected &&
                    isVisible(element) &&
                    !isDisabled(element) &&
                    clickableLabel(element) === label
                ) {
                    manualButton = element;
                    setStatus(
                        'O site exige um clique real neste botão. Clique nele para continuar.',
                        'waiting'
                    );
                }
            }, 2200);

            return true;
        } catch (error) {
            element.dataset[CLICKED] = '0';
            setStatus('O clique automático falhou; clique manualmente neste botão.', 'error');
            console.error(PREFIX, error);
            return true;
        }
    }

    function processStepButtons() {
        if (!looksLikeStepPage()) return false;

        if (manualButton) {
            if (manualButton.isConnected && isVisible(manualButton)) {
                setStatus(
                    'O site exige um clique real neste botão. Clique nele para continuar.',
                    'waiting'
                );
                return true;
            }

            manualButton = null;
        }

        if (visibleCaptchaWidget()) {
            setStatus(
                'Resolva a verificação humana; depois o avanço será automático.',
                'waiting'
            );
            return true;
        }

        const candidate = findActionButton();
        if (!candidate) return false;

        return automaticClick(candidate);
    }

    function visibleProgress() {
        const bars = document.querySelectorAll(
            '[role="progressbar"], .progress-bar, [class*="progress-bar"], [id*="progress"]'
        );

        let best = null;

        for (const bar of bars) {
            if (!isVisible(bar)) continue;

            const current = Number(bar.getAttribute('aria-valuenow'));
            const maximum = Number(bar.getAttribute('aria-valuemax')) || 100;

            if (Number.isFinite(current) && current >= 0) {
                const percent = Math.round((current / maximum) * 100);
                best = best === null ? percent : Math.max(best, percent);
                continue;
            }

            const match = (bar.textContent || '').match(/(\d{1,3})\s*%/);

            if (match) {
                const percent = Math.min(100, Number(match[1]));
                best = best === null ? percent : Math.max(best, percent);
            }
        }

        return best;
    }

    function updateWaitingStatus() {
        if (!looksLikeStepPage()) return;

        const progress = visibleProgress();

        if (progress !== null && progress < 100) {
            setStatus(`Aguardando a contagem da página: ${progress}%…`);
        } else if (progress === 100) {
            setStatus('Contagem concluída; aguardando a próxima ação…');
        } else {
            setStatus('Etapa reconhecida; aguardando a página liberar a próxima ação…');
        }
    }

    function tick() {
        installStyles();
        suppressAntiAdblock();

        const verificationState = processVerificationForms();
        if (verificationState !== 'none') return;

        if (processSpeedTokenForms()) return;
        if (processVisibleFinalLinks()) return;
        if (processStepButtons()) return;

        updateWaitingStatus();
    }

    function scheduleTick() {
        if (tickQueued) return;

        tickQueued = true;

        setTimeout(() => {
            tickQueued = false;

            try {
                tick();
            } catch (error) {
                setStatus(
                    'Ocorreu um erro na automação; consulte o console.',
                    'error'
                );
                console.error(PREFIX, error);
            }
        }, 100);
    }

    function start() {
        installStyles();
        setStatus('Automação Shrtslug ativa.');
        scheduleTick();

        const observer = new MutationObserver(scheduleTick);

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: [
                'class',
                'style',
                'hidden',
                'disabled',
                'aria-disabled',
                'aria-valuenow',
                'value'
            ]
        });

        setInterval(scheduleTick, 750);
    }

    installStyles();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})();
