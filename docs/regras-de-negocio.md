# Requisitos e regras de negócio

## Origem e estado

Origem: conversa com o usuário em 08/11/2026. A primeira solicitação autorizou a preparação dos documentos. Em solicitação posterior, o usuário autorizou a implementação e publicação no GitHub de um **primeiro núcleo simples e funcional**, priorizando uso real com PowerShell, `npm run dev` e ferramentas de agente. As políticas P01–P06 abaixo permanecem propostas, sem confirmação como regras permanentes.

## Requisitos explícitos

**RF13 (pedido posterior, autorizado em 08/11/2026):** lançar uma versão baixável do aplicativo para teste. Publicação autorizada no repositório existente `KauaMarques-js/ChatAgente`, com pacote Windows, instruções e limites da prévia. Instalador por usuário e ZIP para Windows x64 são escolhas técnicas reversíveis. Não autoriza consumo de inferência, despesas com assinatura digital ou alteração das propostas P01–P06.

**RF12 (pedido posterior, autorizado em 08/11/2026):** ao selecionar um projeto, exibir um explorador lateral de arquivos semelhante à referência do VS Code fornecida pelo usuário, com raiz do projeto, hierarquia de pastas expansíveis, arquivos e indicação visual de seleção. Ícones por tipo, indicadores reais do Git, atualização e prévia de texto somente leitura são detalhes de implementação reversíveis. Não autoriza ampliar as permissões do agente nem confirma P01–P06.

**RF11 (pedido posterior, autorizado em 08/11/2026):** PowerShell integrado com atalhos semelhantes aos de uma IDE: `Ctrl + '` abre/oculta o painel e `Ctrl + C` interrompe a execução com foco no terminal. A interrupção encerra o comando, mantendo o aplicativo aberto; com texto selecionado, o atalho preserva a cópia. O painel exibe saída em tempo real e permite acompanhar comandos duradouros como `npm run dev`. Histórico pelas setas e botões de controle são detalhes de implementação reversíveis. A sessão PowerShell persistente e programas interativos continuam como evolução futura.

**RF10 (pedido posterior, autorizado em 08/11/2026):** projeto gratuito e open source, com login oficial ChatGPT sem exigir chave de API. O agente ChatGPT da aplicação usa OAuth e não recorre automaticamente a API key. Gratuidade do software não garante inferência gratuita; respeitar elegibilidade, permissões e limites da conta, sem prometer acesso irrestrito ou contornar cobrança. Codex mantém a integração independente solicitada em RF09.

**RF09 (pedido posterior, autorizado em 08/11/2026):** selecionar entre **ChatGPT** e **Codex** como agentes de programação, com autenticação e execução reais para ambos. ChatGPT usa uma integração própria com ferramentas locais; Codex usa o SDK/CLI oficial. O modo selecionado deve ficar visível e a troca deve exigir tarefa anterior finalizada.

| ID | Requisito | Evidência de aceitação esperada |
| --- | --- | --- |
| RF01 | Aplicativo IDE para Windows centrado no chat | Aplicativo desktop abre e permite iniciar uma conversa |
| RF02 | Usar modelos OpenAI para o agente | Resposta real pelo mecanismo oficial configurado |
| RF03 | Receber arquivos e compreender o projeto | Agente localiza arquivos relacionados e explica contexto relevante |
| RF04 | Ler e modificar arquivos e pastas locais | Alteração solicitada aparece no disco e na revisão |
| RF05 | Trabalhar com Git | Consulta de estado e diferenças; branches e commits em evolução |
| RF06 | Usar navegador | Abre página, inspeciona e interage em cenário verificável |
| RF07 | Acesso amplo ao computador | Ferramentas locais executam dentro do acesso efetivamente concedido |
| RF08 | Trabalho autônomo semelhante ao Codex | Investiga, executa, verifica e relata resultado de uma tarefa |

A expressão “pensar igual ao Codex” significa comportamento observável e qualidade da execução. Não estabelece identidade de modelo, acesso ao raciocínio privado ou equivalência total entre produtos. “Acesso 100%” expressa amplitude desejada; não elimina limites do Windows, permissões do usuário ou capacidades das ferramentas.

## Propostas para o produto — aguardam confirmação quando afetarem a implementação

| ID | Proposta | Impacto e decisão necessária |
| --- | --- | --- |
| P01 | Modos limitado ao projeto e acesso completo ativado pelo usuário | Define acesso inicial, pastas e persistência da autorização |
| P02 | Confirmação contextual para exclusão irreversível, push, publicação e envio externo | Definir quais ações precisam de aprovação e quais já são abrangidas pelo modo completo |
| P03 | Histórico e memória de projeto locais, com exclusão pelo usuário | Definir retenção, conteúdo armazenado e recuperação |
| P04 | Enviar à OpenAI somente contexto necessário à tarefa | Confirmar política de transmissão de arquivos e avisos na configuração |
| P05 | Uso pessoal, uma pessoa e múltiplos projetos locais | Confirmar antes de introduzir contas compartilhadas ou recursos de equipe |
| P06 | Dividir a entrega em núcleo, navegador e controle do Windows | Sequenciamento proposto; navegador e acesso amplo continuam no objetivo final |

## Qualidade e comportamento propostos

Interface em português, erros compreensíveis, navegação por teclado e contraste legível. Mostrar ações e resultados sem revelar segredos. Preservar edições concorrentes: detectar arquivo alterado desde a leitura antes de sobrescrever. Não descartar mudanças existentes do Git nem reverter arquivos do usuário silenciosamente.

Interrupção deve parar o agendamento de novas ferramentas e tentar encerrar processos da tarefa. Efeitos já aplicados permanecem e devem ser informados. Após falha ou reinício, mostrar estado incompleto; não repetir automaticamente uma operação com efeitos sem verificar o resultado anterior.

## Fora do compromisso atual

Não há promessa de equivalência integral ao Codex, aprendizado dos pesos do modelo, memória ilimitada, acesso administrativo automático ou compatibilidade universal com todos os aplicativos. Versão mínima do Windows, distribuição, orçamento de API e modelo serão definidos na implementação com evidências.
