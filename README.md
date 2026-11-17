# FLOW FACTORY — The Ultimate Conveyor Puzzle

Puzzle mobile (retrato) de esteiras transportadoras. O jogador controla desviadores
para levar cada objeto ao recipiente da mesma cor **e forma**, gerenciando várias
linhas de produção ao mesmo tempo, com cruzamentos, junções e congestionamento.

Tecnologia: HTML5 + CSS + JavaScript puro + Canvas 2D + Web Audio. Sem bibliotecas,
sem imagens (tudo é desenhado por código), funciona offline.

---

## Versão 1.1.0: o que está pronto

| Área | Situação |
|---|---|
| Etapa 1 (fundação) | Completa |
| Etapa 2 (produção) | Completa: esteiras, esteira lenta, desviador, cruzamento, distribuidor, bloqueador, junções em zíper, congestionamento, depósito/sobrecarga, pausa, reinício |
| Etapa 3 (progressão) | Completa: 80 fases em 16 capítulos, tutorial interativo para cada mecânica nova, estrelas, salvamento |
| Modos extras | Desafio do dia (uma fase verificada, sorteada pela data) e Modo infinito (ritmo que acelera, recorde) |
| Código de transferência | Em Configurações: copiar o código de progresso e colar em outro aparelho ou depois de reinstalar. Offline, sem conta |
| Etapa 4 (polimento) | Completa: animações, partículas, efeitos e música sintetizados, vibração nativa, áreas seguras |
| Etapa 5 (Android) | Completa: projeto `android/` (Capacitor 8), ícones/splash, workflows do GitHub Actions para APK de teste e AAB assinado. Veja **[ANDROID.md](ANDROID.md)** |

Testes: 29 do motor, 80/80 fases aprovadas pelo validador (solução exata, executável por humano,
replay com toques reais, sem sobreposição) e 123 verificações ponta a ponta no navegador.

### Dispositivos
- **Desviador** (círculo ciano): duas saídas; um toque alterna. A rota trava quando o objeto entra.
- **Cruzamento** (placa cinza): cada objeto segue reto; quem chega primeiro passa primeiro.
- **Distribuidor** (hexágono ciano): alterna as saídas sozinho a cada objeto; um toque pula para a próxima.
- **Bloqueador** (barreira): um toque fecha por 2 s e reabre sozinho; tocar de novo reabre na hora.
- **Esteira lenta** (trilhos âmbar): metade da vazão. Gargalo.
- **Fonte**: produz no seu ritmo para um depósito de 4. Dois esperando = alerta; depósito cheio = sobrecarga.
- **Pintor** (pincel): muda a cor de quem passa. Não pinta o defeituoso.
- **Filtro** (pontos coloridos): a cor marcada sai por um lado, o resto pelo outro. Com várias cores, um toque troca a cor.
- **Esteira expressa** (trilhos índigo): o dobro da velocidade; objetos ultrapassam outras linhas.
- **Ponte**: a linha de cima passa por cima da de baixo, sem ninguém esperar.
- **Recipiente com número**: capacidade limitada; cheio, fecha com cadeado.
- **Prensa**: aceita um objeto e fica fechada enquanto o pistão desce.
- **Esteira reversível**: um toque inverte o sentido, mas só vazia; com carga, recusa.
- **Curinga** (estrela dourada): vale em qualquer recipiente, menos no descarte. **Defeituoso** (hexágono cinza): só no descarte.
- **Vaga de montagem** (tracejada): o jogador coloca as esteiras antes de iniciar.

### Capítulos
1. FIRST SHIFT: fundamentos · 2. NEW ROUTES: cascatas, junções, primeiro cruzamento ·
3. OVERLOAD: esteira lenta, bloqueador, distribuidor · 4. CROSSING LINES: cruzamentos e rotas alternativas ·
5. FACTORY CHAOS: três linhas e quatro cores · 6. MASTER OPERATOR: tudo junto ·
7. PAINT SHOP: pintor · 8. SORTING: filtro e defeituosos · 9. EXPRESS: esteira expressa ·
10. OVERPASS: pontes · 11. FULL HOUSE: capacidade · 12. HEAVY PRESS: prensa ·
13. TWO-WAY: esteira reversível · 14. WILD & DEFECTS: curinga · 15. BLUEPRINT: montagem ·
16. GRAND FACTORY: tudo junto

### Salvar progresso (código de transferência)
Em **Configurações → Copiar meu código de progresso** o jogo mostra e copia um texto como
`FF-06J5-D778-2RHA-...`. Guarde (por exemplo, mandando para você mesmo no WhatsApp). Em outro
celular, ou depois de reinstalar, use **Colar código → Recuperar progresso**. O código leva fases,
estrelas, recorde do infinito e dias de desafio; tem verificação contra erro de digitação
(CRC-16) e aceita minúsculas e espaços. Colar junta com o que já existe no aparelho, ficando
sempre o melhor de cada fase: nunca apaga nada.

---

## Rodar no navegador

```bash
npm run serve          # abre um servidor em http://localhost:8080
```

Ou abra `dist/flow-factory.html`: é o jogo inteiro num único arquivo (gere com `npm run build:single`).

Atalhos no computador: **Espaço** inicia/pausa, **R** reinicia, **1–9** alternam os desviadores.

---

## Estrutura

```
www/                     ← tudo que vai para o app (webDir do Capacitor)
  index.html
  css/style.css
  fonts/                 Barlow e Barlow Condensed (licença OFL)
  icons/                 ícones 192/512/1024 + icon.svg
  js/config.js           constantes, direções, categorias, paleta
  js/factory.js          lê o mapa da fase e monta a fábrica + geometria dos trajetos
  js/routing.js          regras de cada dispositivo (esteira, desviador, cruzamento, recipiente)
  js/conveyor.js         faixas, espaçamento, capacidade, zíper nos nós
  js/simulation.js       tick fixo, fontes, entregas, vitória, falha, estrelas
  js/levels.js           capítulos 1–6 (levels2.js: 7–10, levels3.js: 11–16)
  js/modes.js            desafio do dia e modo infinito
  js/transfer.js         código de transferência de progresso
  js/storage.js          progresso, configurações e vibração
  js/audio.js            efeitos e música generativa (Web Audio)
  js/renderer.js         desenho no Canvas
  js/ui.js               telas, HUD, modais, tutorial
  js/native.js           Android: Voltar, segundo plano, vibração (Haptics)
  js/main.js             laço principal e controle da sessão
  sw.js, manifest.webmanifest   offline no navegador (PWA)
tools/
  solver.js              busca exaustiva de soluções
  validate.js            validador de fases (obrigatório antes de publicar fases)
  build-single.js        gera dist/flow-factory.html
tests/
  sim.test.js            testes do motor (Node)
  e2e_full.py            teste ponta a ponta no navegador (Playwright)
```

---

## Regras da simulação (determinística)

- Tick fixo de 60 Hz e **aritmética inteira**: a mesma fase com os mesmos toques nos
  mesmos ticks produz sempre o mesmo resultado.
- Cada bloco = 100 unidades de trajeto (meia entrada + meia saída). Velocidade padrão:
  2 unidades/tick (1,2 bloco/s).
- **Espaçamento mínimo** de 50 unidades na mesma faixa → capacidade de 2 objetos por bloco.
- **Junções e cruzamentos funcionam em zíper**: quem está mais perto do centro passa
  primeiro; empate = objeto mais antigo. Faixas que se cruzam mantêm 60 unidades.
  Objetos nunca se sobrepõem (verificado em todo tick pelos testes).
- **Desviador**: a rota trava quando o objeto **entra** no bloco do desviador. Tocar muda a
  rota de todos que ainda não entraram.
- **Congestionamento**: cada fonte produz no seu ritmo para um depósito de 4 objetos (os traços na
  máquina). Se a esteira não escoa, o depósito enche: com 2 esperando entra em alerta (perde a estrela
  de fluxo); se precisar guardar um 5º, a fase falha por sobrecarga. Blocos com objetos parados ficam com
  trilhos âmbar.
- **Bloqueador**: fecha por 2 s e reabre sozinho. Quem já passou da linha de parada segue.
- **Falhas**: recipiente errado, depósito lotado, fábrica travada (nada se move há 5 s e nada mais vai ser produzido).
  O problema é marcado com um anel vermelho.
- **Estrelas**: ① todos entregues ② sem sobrecarga ③ intervenções durante a produção ≤ meta.
  Toques no planejamento são livres (experimentar não é punido).

---

## Validador de fases

```bash
npm test               # motor + todas as fases
node tools/validate.js 2-4      # uma fase específica
```

Como funciona: o estado de um desviador só importa no instante em que um objeto entra
nele. Logo, qualquer estratégia do jogador equivale a uma sequência de escolhas nesses
instantes. O solver faz uma **busca em profundidade exata** sobre essas escolhas, rodando
a simulação real entre elas. Para cada fase ele verifica:

- conexões quebradas, saídas para fora do mapa, cruzamentos com fluxo frontal,
  blocos inalcançáveis, cores sem recipiente;
- existência de solução, solução sem sobrecarga e meta (`par`) alcançável;
- se a solução é **executável por um humano** (janela mínima de 0,4 s entre objetos para
  trocar um desviador e 0,25 s entre dois toques);
- replay da solução usando só a API pública do jogo (toques reais);
- distância entre objetos em todos os ticks (nenhuma sobreposição);
- se a fase “se resolve sozinha” quando deveria exigir ação.

## Criar uma fase

```js
{
  id: '3-1', chapter: 3, name: 'Nome', par: 4, requiresAction: true,
  map: [
    '..A..',      // '.' vazio, '^ > v <' esteira, '+' cruzamento
    '..v..',      // demais caracteres vêm da legenda
    '.vdv.',
    '.1.2.'
  ],
  legend: {
    A: { type: 'source', out: 'S', seq: 'RR__BB', interval: 110, delay: 20 }, // '_' = pausa de um intervalo
    d: { type: 'diverter', outs: ['W', 'E'], state: 0 },
    1: { type: 'bin', cat: 'R' }, 2: { type: 'bin', cat: 'B' }
  },
  tutorial: [{ text: 'Texto curto', target: 'device:0', until: 'toggle' }]
}
```

Rode `node tools/validate.js 3-1`: ele informa o mínimo de intervenções (use como `par`),
a janela de reação mais apertada e qualquer problema estrutural.

Para calibrar a dificuldade, adicione um campo `tune` com variações de sequência, ritmo e atraso
(`tune: { A: { seq: [...], interval: [...], delay: [...] } }`) e rode
`python3 tools/tune-batch.py 3-1`: ele testa as variações com o solucionador, escolhe a que fica
mais perto da meta de toques da posição na campanha e grava `par` e a fonte na fase.

---

## Android

Tudo sobre APK, AAB, assinatura, GitHub Actions e publicação está em **[ANDROID.md](ANDROID.md)**.
Resumo: cada push na branch `main` gera um APK de teste em *Actions → Android — APK de teste → Artifacts*.

---

## Monetização futura (não implementada)

Nenhum anúncio, moeda ou loja nesta versão. Pontos de encaixe já existentes:
- **Dica recompensada**: o solver gera a solução de referência de cada fase
  (`node tools/validate.js --json` → `info.reference`), pronta para virar dica.
- **Tentativa adicional**: a falha passa por `showFail()` em `main.js`, onde entraria a oferta.
- **Temas visuais**: cores centralizadas em `FF.PALETTE` e `FF.CATS` (`config.js`).

## Créditos

Fontes Barlow e Barlow Condensed (Jeremy Tribby), licença SIL Open Font License, em `www/fonts/`.
Todo o resto (código, arte procedural, áudio sintetizado) é original deste projeto.
