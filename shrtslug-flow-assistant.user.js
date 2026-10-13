// ==UserScript==
// @name         LinkFlow — Link Assistant
// @name:pt-BR   LinkFlow — Assistente de Links
// @namespace    https://github.com/adestrador/shrtslug-flow-assistant
// @version      1.5.1
// @description  Continues supported Shrtslug steps when ready, waits for site timers, and resumes after manual CAPTCHA verification.
// @description:pt-BR Aguarda a contagem do site, aciona as etapas liberadas e retoma após CAPTCHA manual, sem painel no rodapé.
// @author       tigerwong
// @homepageURL  https://github.com/adestrador/shrtslug-flow-assistant
// @supportURL   https://github.com/adestrador/shrtslug-flow-assistant/issues
// @updateURL    https://raw.githubusercontent.com/adestrador/shrtslug-flow-assistant/main/shrtslug-flow-assistant.user.js
// @downloadURL  https://raw.githubusercontent.com/adestrador/shrtslug-flow-assistant/main/shrtslug-flow-assistant.user.js
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
// @grant        unsafeWindow
// @grant        GM.registerMenuCommand
// @grant        GM.setClipboard
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// @noframes
// ==/UserScript==

(() => {
    'use strict';

    const PREFIX = '[LinkFlow]';
    const BACKGROUND_COUNTDOWN = true;
    const INITIAL_DELAY = 900;
    const ACTION_DELAY = 500;
    const RETRY_DELAY = 8000;
    const MAX_ATTEMPTS = 2;
    const startedAt = Date.now();
    const attempts = new WeakMap();
    const firstSeen = new WeakMap();
    const captchaPresented = new WeakSet();
    let queued = false;
    let lastMessage = '';
    let suspended = false;

    function status(message) {
        if (message === lastMessage) return;
        lastMessage = message;
        console.info(PREFIX, message);
    }

    // Aplica a compatibilidade no documento da página, fora do contexto isolado do gerenciador.
    function installBackgroundCompatibility() {
        if (!BACKGROUND_COUNTDOWN) return;
        try {
            const pageWindow = typeof unsafeWindow !== 'undefined'
                ? unsafeWindow : (window.wrappedJSObject || window);
            const pageDocument = document.wrappedJSObject ||
                pageWindow.document.wrappedJSObject || pageWindow.document;
            Object.defineProperty(pageDocument, 'hidden', {
                configurable: true, value: false
            });
            Object.defineProperty(pageDocument, 'visibilityState', {
                configurable: true, value: 'visible'
            });
            // Mantém o tempo original. Abas inativas ainda podem ter timers limitados.
            status('Compatibilidade de contagem aplicada no contexto da página.');
        } catch (error) {
            console.warn(PREFIX, 'Não foi possível ajustar a contagem em segundo plano.', error);
        }
    }

    function normalize(value) {
        return String(value || '').normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[↓↑→←]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    }

    function visible(element) {
        if (!(element instanceof Element) || !element.isConnected) return false;
        for (let current = element; current instanceof Element; current = current.parentElement) {
            if (current.hidden || current.getAttribute('aria-hidden') === 'true') return false;
            const style = getComputedStyle(current);
            if (style.display === 'none' || style.visibility === 'hidden' ||
                style.visibility === 'collapse' || Number(style.opacity) === 0) return false;
        }
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function disabled(element) {
        return Boolean(element.disabled || element.matches(':disabled') ||
            element.getAttribute('aria-disabled') === 'true' ||
            element.classList.contains('disabled') ||
            getComputedStyle(element).pointerEvents === 'none');
    }

    function label(element) {
        return normalize(element.getAttribute('aria-label') || element.value ||
            element.textContent || element.getAttribute('title') ||
            element.querySelector('img[alt]')?.alt);
    }

    function token(scope) {
        return [...scope.querySelectorAll(
            '[name="cf-turnstile-response"], [name="g-recaptcha-response"], [name="h-captcha-response"]'
        )].some(field => Boolean(field.value?.trim()));
    }

    function needsCaptcha(form) {
        return Boolean(form.querySelector(
            '.cf-turnstile, .g-recaptcha, .h-captcha, [name="cf-turnstile-response"], ' +
            '[name="g-recaptcha-response"], [name="h-captcha-response"]'
        )) && !token(form);
    }

    function submitButton(form) {
        // IDs repetidos são usados pelo site; a busca sempre fica dentro do formulário.
        return [...form.querySelectorAll('button, input[type="submit"]')].find(button =>
            button.form === form && (button.type === 'submit' ||
                (button.tagName === 'BUTTON' && !button.hasAttribute('type')))
        ) || null;
    }

    function formUrl(form) {
        // Um input chamado "action" sobrescreve form.action neste site.
        // O atributo mantém o endereço correto independentemente desse input.
        const action = form.getAttribute('action');
        return action ? new URL(action, location.href).href : '';
    }

    function gatedByProgress(form) {
        const area = form.closest('[id$="_area"]') || form.parentElement;
        for (const bar of area?.querySelectorAll('.progress-done, [role="progressbar"]') || []) {
            if (!visible(bar)) continue;
            const match = bar.textContent.match(/(\d{1,3})\s*%/);
            if (match && Number(match[1]) < 100) return true;
        }
        const number = area?.querySelector('#countdown-number');
        if (number && visible(number) && /^\d+$/.test(number.textContent.trim()) &&
            Number(number.textContent.trim()) > 0) return true;
        return false;
    }

    function canAct(element, signature) {
        let state = attempts.get(element);
        if (!state || state.signature !== signature) {
            state = { signature, count: 0, at: 0 };
            attempts.set(element, state);
            firstSeen.set(element, Date.now());
        }
        if (Date.now() - firstSeen.get(element) < ACTION_DELAY) return 'waiting';
        if (state.count >= MAX_ATTEMPTS) {
            status('A etapa não avançou após duas tentativas; prossiga manualmente.');
            return 'exhausted';
        }
        if (state.at && Date.now() - state.at < RETRY_DELAY) return 'waiting';
        state.count += 1;
        state.at = Date.now();
        return 'ready';
    }

    function clickControl(button, signature) {
        if (!visible(button) || disabled(button)) return false;
        const readiness = canAct(button, signature);
        if (readiness === 'exhausted') return false;
        if (readiness !== 'ready') return true;
        status(`Clicando: ${label(button)}`);
        try {
            button.click();
        } catch (error) {
            console.warn(PREFIX, 'Não foi possível clicar no controle.', error);
        }
        return true;
    }

    function submitForm(form, signature, requireVisibleButton = true) {
        const button = submitButton(form);
        if (button && (disabled(button) || (requireVisibleButton && !visible(button)))) return false;
        if (typeof form.checkValidity === 'function' && !form.checkValidity()) return false;
        const readiness = canAct(form, signature);
        if (readiness === 'exhausted') return false;
        if (readiness !== 'ready') return true;
        status('Enviando a etapa liberada.');
        try {
            const attempt = attempts.get(form).count;
            if (button && attempt === 1) {
                // Primeiro inclui o handler click do botão, quando ele existe.
                // requestSubmit sozinho não dispara esse handler.
                button.click();
            } else if (typeof form.requestSubmit === 'function') {
                // Se o clique não produziu avanço, tenta o submit na segunda
                // oportunidade. Botões desabilitados não são reenviados.
                form.requestSubmit(button || undefined);
            } else if (button) {
                button.click();
            } else {
                const event = new Event('submit', { bubbles: true, cancelable: true });
                if (form.dispatchEvent(event)) HTMLFormElement.prototype.submit.call(form);
            }
        } catch (error) {
            console.warn(PREFIX, 'Não foi possível enviar o formulário.', error);
        }
        return true;
    }

    function processNextForms() {
        for (const input of document.querySelectorAll('form input[name="speed_token"]')) {
            const form = input.form;
            if (!form || !input.value?.trim()) continue;
            // Não envia enquanto o servidor ainda não tiver definido a próxima página.
            const destination = form.getAttribute('action');
            const url = formUrl(form);
            if (!destination || !/^https?:/i.test(url)) continue;
            const button = submitButton(form);
            if (button && (!visible(button) || disabled(button))) continue;
            if (needsCaptcha(form)) continue;
            if (submitForm(form, `next|${url}|${input.value}`, Boolean(button))) return true;
        }
        return false;
    }

    function processStart() {
        for (const area of document.querySelectorAll('[id$="_start_area"]')) {
            if (!visible(area)) continue;
            const button = [...area.querySelectorAll('button, [role="button"]')]
                .find(control => control.id.endsWith('_start') && visible(control));
            if (!button) continue;
            // Enquanto "Starting in 2/1" está desabilitado, aguarda o próprio site.
            if (disabled(button)) return true;
            if (clickControl(button, `start|${location.href}`)) return true;
        }
        return false;
    }

    function processVerification() {
        for (const form of document.querySelectorAll('form[action*="/api-endpoint/verify"]')) {
            if (!visible(form)) continue;
            const start = form.id && document.getElementById(`${form.id}_start_area`);
            if (start && visible(start)) continue;
            if (needsCaptcha(form)) {
                status('Aguardando a verificação humana feita por você.');
                // Leva a caixa para a tela uma vez; após a validação, o envio
                // é automático. Não tenta clicar dentro do CAPTCHA.
                if (!captchaPresented.has(form)) {
                    captchaPresented.add(form);
                    const widget = form.querySelector('.cf-turnstile, .g-recaptcha, .h-captcha');
                    widget?.scrollIntoView({ block: 'center', behavior: 'auto' });
                }
                return true;
            }
            const button = submitButton(form);
            if (button && (!visible(button) || disabled(button))) continue;
            if (gatedByProgress(form)) return true;
            const action = form.querySelector('[name="action"]')?.value || '';
            const captchaResponse = [...form.querySelectorAll(
                '[name="cf-turnstile-response"], [name="g-recaptcha-response"], [name="h-captcha-response"]'
            )].map(field => field.value || '').join('|');
            if (submitForm(form, `verify|${action}|${captchaResponse}`)) return true;
        }
        return false;
    }

    function knownStepPage() {
        return Boolean(document.querySelector(
            '[id$="_start_area"], form[action*="/api-endpoint/verify"], input[name="speed_token"]'
        ));
    }

    function knownLabel(text) {
        return /^(abrir|open|start|iniciar|comecar|verificar|verify|continuar|continue|prosseguir|next|proximo(?: post)?|avancar|obter link|get link|go to link|ir para o link|acessar link)$/.test(text) ||
            /^(?:clique (?:aqui )?para|click (?:here )?to) (?:prosseguir|continuar|verificar|avancar|continue|verify|proceed|start|comecar)$/.test(text) ||
            /^(?:ir|avancar|continuar) para (?:a )?proxima etapa$/.test(text) ||
            /^(?:clique (?:aqui )?(?:na|sobre a) imagem|click (?:here )?(?:on )?(?:the )?image)$/.test(text);
    }

    function processFallback() {
        if (!knownStepPage()) return false;
        for (const control of document.querySelectorAll('button, input[type="button"], input[type="submit"], a[role="button"]')) {
            if (!visible(control) || disabled(control)) continue;
            const text = label(control);
            if (!knownLabel(text)) continue;
            const form = control.closest('form');
            // Os formulários conhecidos são tratados acima, inclusive CAPTCHA e timers.
            if (form?.querySelector('[name="speed_token"]') ||
                (form && formUrl(form).includes('/api-endpoint/verify'))) continue;
            if (form && needsCaptcha(form)) continue;
            if (clickControl(control, `fallback|${text}|${location.href}`)) return true;
        }
        return false;
    }

    function suppressAntiAdblock() {
        // Oculta o aviso de bloqueador sem reaplicar estilos a cada ciclo.
        for (const control of document.querySelectorAll('[data-action="recheck"], [data-action="reload"]')) {
            const overlay = control.closest('[id]');
            if (!overlay || overlay === document.body || overlay === document.documentElement ||
                overlay.id === 'main_area') continue;
            if (overlay.style.getPropertyValue('display') !== 'none') {
                overlay.style.setProperty('display', 'none', 'important');
            }
            if (!overlay.classList.contains('hidden')) overlay.classList.add('hidden');
            const main = document.getElementById('main_area');
            if (main && main.style.getPropertyValue('display') !== 'block') {
                main.style.setProperty('display', 'block', 'important');
            }
            if (document.body?.style.overflow) document.body.style.removeProperty('overflow');
        }
    }

    function tick() {
        if (suspended || !document.body || Date.now() - startedAt < INITIAL_DELAY) return;
        const fatal = [...document.querySelectorAll('#alert, [role="alert"]')].some(element =>
            visible(element) && /(?:reload|refresh|recarreg|atualiz.{0,25}pagina)/.test(normalize(element.textContent))
        );
        if (fatal) {
            status('O site pediu para recarregar a página; a automação foi pausada.');
            return;
        }
        suppressAntiAdblock();
        // A próxima página pronta tem prioridade sobre o formulário antigo que
        // continua no DOM com seu botão permanentemente em estado "Loading".
        if (processNextForms()) return;
        if (processStart()) return;
        if (processVerification()) return;
        processFallback();
    }

    function schedule() {
        if (queued) return;
        queued = true;
        setTimeout(() => {
            queued = false;
            try { tick(); } catch (error) {
                console.warn(PREFIX, 'Erro ao acompanhar a etapa.', error);
            }
        }, 100);
    }

    // Aceita as duas famílias de APIs oferecidas pelos gerenciadores.
    function registerMenuCommand(name, callback) {
        if (typeof GM !== 'undefined' && typeof GM.registerMenuCommand === 'function') {
            return GM.registerMenuCommand(name, callback);
        }
        if (typeof GM_registerMenuCommand === 'function') {
            return GM_registerMenuCommand(name, callback);
        }
        return null;
    }

    async function copyToClipboard(text) {
        if (typeof GM !== 'undefined' && typeof GM.setClipboard === 'function') {
            await GM.setClipboard(text);
        } else if (typeof GM_setClipboard === 'function') {
            await GM_setClipboard(text);
        } else {
            await navigator.clipboard.writeText(text);
        }
    }

    function start() {
        // Remove apenas um painel residual da versão antiga nesta mesma página.
        document.getElementById('shrtslug-auto-status')?.remove();
        try {
            registerMenuCommand('LinkFlow: copiar diagnóstico', async () => {
                const diagnosis = {
                    version: '1.5.1', page: location.origin + location.pathname,
                    status: lastMessage,
                    controls: [...document.querySelectorAll('button, input[type="submit"], [role="button"]')]
                        .filter(visible).slice(0, 30).map(element => ({
                            id: element.id, label: label(element), disabled: disabled(element),
                            formId: element.closest('form')?.id || '',
                            attempts: attempts.get(element.closest('form') || element)?.count || 0
                        })),
                    forms: [...document.querySelectorAll('form[action*="/api-endpoint/verify"], form:has(input[name="speed_token"])')]
                        .map(form => ({ id: form.id, visible: visible(form),
                            captchaPending: needsCaptcha(form), timerPending: gatedByProgress(form),
                            nextReady: Boolean(form.querySelector('[name="speed_token"]')?.value?.trim()) })),
                    alerts: [...document.querySelectorAll('#alert, [role="alert"]')]
                        .filter(visible).map(element => element.textContent.trim().slice(0, 250))
                };
                const text = JSON.stringify(diagnosis, null, 2);
                try {
                    await copyToClipboard(text);
                    alert('Diagnóstico copiado. Inclua-o no relato da etapa que travou.');
                } catch (error) {
                    console.info(PREFIX, text);
                    alert('Não foi possível copiar. O diagnóstico foi registrado no console.');
                }
            });
        } catch (error) {
            console.warn(PREFIX, 'Menu de diagnóstico indisponível.', error);
        }
        const observer = new MutationObserver(schedule);
        observer.observe(document.documentElement, {
            childList: true, subtree: true, characterData: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'hidden', 'disabled', 'aria-disabled', 'action']
        });
        document.addEventListener('click', event => {
            if (!event.isTrusted) return;
            const control = event.target instanceof Element ?
                event.target.closest('button, input[type="submit"], [role="button"]') : null;
            if (control) {
                attempts.delete(control);
                if (control.closest('form')) attempts.delete(control.closest('form'));
            }
        }, true);
        window.addEventListener('pagehide', () => { suspended = true; });
        window.addEventListener('pageshow', () => { suspended = false; schedule(); });
        setInterval(schedule, 750);
        schedule();
    }

    installBackgroundCompatibility();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})();