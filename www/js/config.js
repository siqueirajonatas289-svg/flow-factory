/* FLOW FACTORY — config.js
 * Constantes globais do jogo. Todas as distâncias da simulação usam
 * unidades inteiras: 1 bloco (tile) = 100 unidades de trajeto
 * (meia entrada de 50 + meia saída de 50). Isso mantém a simulação
 * 100% determinística (sem ponto flutuante na lógica).
 */
(function (FF) {
  'use strict';

  FF.CONFIG = Object.freeze({
    VERSION: '1.1.0',
    TICK_RATE: 60,          // ticks de simulação por segundo
    HALF: 50,               // comprimento de meio bloco (entrada ou saída)
    GAP: 50,                // distância mínima entre objetos na mesma faixa
    NODE_GAP: 60,           // distância mínima entre faixas diferentes num nó (cruzamento/desviador)
    EDGE_STOP: 22,          // onde o objeto para diante de uma saída sem conexão
    GATE_STOP: 24,          // linha de parada do bloqueador (antes do centro do bloco)
    GATE_TICKS: 120,        // bloqueador fecha por 2 s e reabre sozinho
    SLOW_SPEED: 1,          // esteira lenta (metade da vazão)
    FAST_SPEED: 4,          // esteira expressa (dobro da velocidade)
    BIN_STOP: 24,           // recipiente fechado (cheio ou prensando): fila para aqui
    BASE_SPEED: 2,          // unidades por tick (= 1,2 bloco por segundo)
    DEFAULT_INTERVAL: 96,   // ticks entre emissões de uma fonte
    FIRST_DELAY: 30,        // ticks até a primeira emissão
    HOPPER_MAX: 4,          // depósito da fonte: objetos produzidos esperando para sair
    HOPPER_WARN: 2,         // 2 esperando = alerta (perde a estrela de fluxo); produzir com 4 = sobrecarga
    STALL_TICKS: 20,        // objeto parado há este tempo = congestionado
    GRIDLOCK_TICKS: 300,    // nada se move há 5 s = fábrica travada
    MAX_TICKS: 60 * 60 * 10,
    // Validador: limites humanos para uma solução de referência
    MIN_TAP_WINDOW: 36,     // janela mínima (0,6 s) para trocar um desviador entre dois objetos
    MIN_TAP_GAP: 15,        // intervalo mínimo entre dois toques quaisquer (0,25 s)
    ITEM_SIZE: 0.36         // diâmetro visual do objeto, em blocos
  });

  // Direções: 0=N (cima) 1=L (direita) 2=S (baixo) 3=O (esquerda)
  FF.DX = [0, 1, 0, -1];
  FF.DY = [-1, 0, 1, 0];
  FF.opp = function (d) { return (d + 2) & 3; };
  FF.DIR_BY_NAME = { N: 0, E: 1, S: 2, W: 3, U: 0, R: 1, D: 2, L: 3 };
  FF.SINK = -1;      // saída = recipiente (o objeto é consumido no centro)
  FF.UNKNOWN = -3;   // rota ainda não decidida (objeto antes de um desviador)

  // Categorias: cor + forma (acessível para daltonismo)
  FF.CATS = {
    R: { key: 'R', name: 'Vermelho', color: '#ff4f62', dark: '#9e1f33', light: '#ff9aa6', shape: 'circle', pitch: 0 },
    B: { key: 'B', name: 'Azul', color: '#3d8bff', dark: '#173f99', light: '#9cc4ff', shape: 'square', pitch: 3 },
    Y: { key: 'Y', name: 'Amarelo', color: '#ffc733', dark: '#9c7100', light: '#ffe59a', shape: 'triangle', pitch: 5 },
    G: { key: 'G', name: 'Verde', color: '#2fd47c', dark: '#11703c', light: '#98f0c0', shape: 'diamond', pitch: 7 },
    W: { key: 'W', name: 'Curinga', color: '#ffe27a', dark: '#a8741a', light: '#fff6cf', shape: 'star', pitch: 12 },
    X: { key: 'X', name: 'Defeituoso', color: '#8b93a6', dark: '#3d4352', light: '#c6ccd8', shape: 'hex', pitch: -5 }
  };
  // Curinga entra em qualquer recipiente; defeituoso só no descarte (recipiente X).
  FF.binAccepts = function (binCat, cat) { return cat === binCat || (cat === 'W' && binCat !== 'X'); };

  FF.PALETTE = {
    bg: '#070c1a',
    bg2: '#0c1428',
    floor: '#121a2c',
    surface: '#1b2436',
    surface2: '#253047',
    belt: '#0d1320',
    beltEdge: '#3a4660',
    chevron: '#26324a',
    rail: '#4a5874',
    cyan: '#2fe6e6',
    cyanDim: '#167a86',
    white: '#f2f6ff',
    muted: '#8a97b2',
    warn: '#ffb02e',
    danger: '#ff4d4d'
  };
})(globalThis.FF = globalThis.FF || {});
