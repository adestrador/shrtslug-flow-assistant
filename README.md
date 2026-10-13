# LinkFlow — Assistente de Links

Um userscript para acompanhar as etapas do Shrtslug com um gerenciador de scripts do navegador. Ele aguarda a contagem da página e tenta avançar quando os controles são liberados. O CAPTCHA continua manual.

[Instalar o LinkFlow](https://raw.githubusercontent.com/adestrador/shrtslug-flow-assistant/main/shrtslug-flow-assistant.user.js) · [Relatar uma falha](https://github.com/adestrador/shrtslug-flow-assistant/issues)

## Instalação e uso

1. Instale um gerenciador de userscripts disponível para seu navegador, como **Tampermonkey**, **Violentmonkey** ou **Greasemonkey**.
2. Abra o link de instalação acima e confirme no gerenciador escolhido.
3. Acesse um link do Shrtslug normalmente.
4. Resolva o CAPTCHA quando aparecer. Depois da validação, o script tenta continuar sozinho.

Se estiver atualizando uma cópia antiga, mantenha apenas uma versão ativa. O script agora aparece como **LinkFlow — Assistente de Links**; o arquivo e o endereço do repositório continuam os mesmos.

## Gerenciadores e compatibilidade

O LinkFlow reconhece as APIs modernas e clássicas de menu e área de transferência usadas por Greasemonkey, Tampermonkey e Violentmonkey. Escolha um gerenciador disponível para seu navegador; não é necessário instalar todos.

A adaptação das APIs foi verificada em testes locais. O fluxo completo ainda precisa ser validado em cada combinação de navegador e extensão. Se relatar uma falha, informe o navegador, o gerenciador e suas versões.

## O que mudou na versão 1.5.1

- Adicionado suporte às APIs modernas e clássicas de menu e área de transferência.
- Atualizadas as instruções para diferentes gerenciadores de userscripts.

## Mudanças da versão 1.5.0

- Removido o painel de mensagens no rodapé.
- Corrigida a escolha dos botões em páginas com IDs repetidos.
- A próxima etapa pronta tem prioridade sobre formulários antigos que permanecem na página.
- A contagem em percentual e a contagem numérica são respeitadas antes do envio.
- Os cliques têm tentativas limitadas, e o acompanhamento para quando a página pede atualização.
- Adicionado **LinkFlow: copiar diagnóstico** ao menu do gerenciador de scripts.

## Contagem e intervenção manual

O LinkFlow mantém a duração original da contagem. Ele tenta permitir que as etapas compatíveis continuem em segundo plano, mas o navegador pode limitar os temporizadores de abas inativas.

Algumas páginas ainda podem exigir a aba visível ou um clique manual. Se uma etapa não avançar, clique no controle indicado pelo site. Se a página pedir atualização, recarregue-a antes de continuar.

## Sites atendidos

- `shrtslug.biz`
- `digiztechno.com`
- `tournguide.com`
- `yrtourguide.com`
- `techmize.net`
- `technons.com`
- `biovetro.net`
- `dailyjobposting.xyz`
- `financefernly.com`

Os subdomínios desses sites também estão incluídos. Mudanças no layout podem interromper o avanço automático.

## Diagnóstico e privacidade

Quando uma etapa travar, abra o menu do gerenciador de scripts e escolha **LinkFlow: copiar diagnóstico**. Revise o texto antes de incluí-lo em uma issue, especialmente as mensagens exibidas pelo site.

O diagnóstico reúne o endereço da página sem os parâmetros da URL, o estado dos controles e as mensagens de erro. Os valores dos tokens de verificação não são incluídos. O script não envia esse relatório automaticamente e não carrega bibliotecas externas.

## English

LinkFlow is a userscript for Shrtslug flow pages, installed through a browser userscript manager. It waits for website timers and clicks available controls. CAPTCHA verification remains manual.

### Install

Open the [installation link](https://raw.githubusercontent.com/adestrador/shrtslug-flow-assistant/main/shrtslug-flow-assistant.user.js) with a userscript manager enabled, such as **Tampermonkey**, **Violentmonkey**, or **Greasemonkey**, and confirm. Then open a Shrtslug link as usual. Complete any CAPTCHA yourself; the script attempts to resume afterward.

When updating, keep only one copy enabled. The script is now named **LinkFlow**, while the repository URL and file path are unchanged.

### Compatibility

LinkFlow accepts both modern and classic menu and clipboard APIs used by Greasemonkey, Tampermonkey, and Violentmonkey. Choose a manager available for your browser.

The API adapters have been checked in local tests. Full site flows still need testing in each browser and extension combination. Include your browser, manager, and their versions when reporting a problem.

### Version 1.5.1

Adds support for both API styles and updates the installation instructions for different userscript managers.

### Changes in 1.5.0

This version removes the on-page status panel, handles duplicate button IDs, prioritizes ready next-step forms, and checks both percentage and numeric countdowns. Attempts are limited, and automation stops while a reload warning is visible.

Background countdown support is best-effort. Timers keep their original duration, and some pages may still need a visible tab or a manual click. The supported domains are listed above.

### Reporting a problem

Use **LinkFlow: copiar diagnóstico** in your userscript manager’s menu and review the report before opening an issue. It includes page details and control states, without URL query parameters or verification token values. Reports are copied locally and are not sent automatically.

## Licença / License

[MIT](LICENSE).
