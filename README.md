# LinkFlow — Assistente de Links

Um userscript para acompanhar as etapas do Shrtslug no Firefox com Greasemonkey. Ele aguarda a contagem da página e tenta avançar quando os controles são liberados. O CAPTCHA continua manual.

[Instalar o LinkFlow](https://raw.githubusercontent.com/adestrador/shrtslug-flow-assistant/main/shrtslug-flow-assistant.user.js) · [Relatar uma falha](https://github.com/adestrador/shrtslug-flow-assistant/issues)

## Instalação e uso

1. Com o Greasemonkey instalado, abra o link de instalação acima e confirme.
2. Acesse um link do Shrtslug normalmente.
3. Resolva o CAPTCHA quando aparecer. Depois da validação, o script tenta continuar sozinho.

Se estiver atualizando uma cópia antiga, mantenha apenas uma versão ativa. O script agora aparece como **LinkFlow — Assistente de Links**; o arquivo e o endereço do repositório continuam os mesmos.

## O que mudou na versão 1.5.0

- Removido o painel de mensagens no rodapé.
- Corrigida a escolha dos botões em páginas com IDs repetidos.
- A próxima etapa pronta tem prioridade sobre formulários antigos que permanecem na página.
- A contagem em percentual e a contagem numérica são respeitadas antes do envio.
- Os cliques têm tentativas limitadas, e o acompanhamento para quando a página pede atualização.
- Adicionado **LinkFlow: copiar diagnóstico** ao menu do Greasemonkey.

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

Quando uma etapa travar, abra o menu do Greasemonkey e escolha **LinkFlow: copiar diagnóstico**. Revise o texto antes de incluí-lo em uma issue, especialmente as mensagens exibidas pelo site.

O diagnóstico reúne o endereço da página sem os parâmetros da URL, o estado dos controles e as mensagens de erro. Os valores dos tokens de verificação não são incluídos. O script não envia esse relatório automaticamente e não carrega bibliotecas externas.

## English

LinkFlow is a userscript for Shrtslug flow pages, intended for Firefox with Greasemonkey. It waits for website timers and clicks available controls. CAPTCHA verification remains manual.

### Install

Open the [installation link](https://raw.githubusercontent.com/adestrador/shrtslug-flow-assistant/main/shrtslug-flow-assistant.user.js) with Greasemonkey enabled and confirm. Then open a Shrtslug link as usual. Complete any CAPTCHA yourself; the script attempts to resume afterward.

When updating, keep only one copy enabled. The script is now named **LinkFlow**, while the repository URL and file path are unchanged.

### Version 1.5.0

This version removes the on-page status panel, handles duplicate button IDs, prioritizes ready next-step forms, and checks both percentage and numeric countdowns. Attempts are limited, and automation stops while a reload warning is visible.

Background countdown support is best-effort. Timers keep their original duration, and some pages may still need a visible tab or a manual click. The supported domains are listed above.

### Reporting a problem

Use **LinkFlow: copiar diagnóstico** in the Greasemonkey menu and review the report before opening an issue. It includes page details and control states, without URL query parameters or verification token values. Reports are copied locally and are not sent automatically.

## Licença / License

[MIT](LICENSE).
