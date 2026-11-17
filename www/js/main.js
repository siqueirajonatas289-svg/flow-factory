/* FLOW FACTORY — main.js
 * Inicialização, laço principal (passo fixo de 60 Hz) e controle da sessão de jogo.
 */
(function (FF) {
  'use strict';
  var C = FF.CONFIG, UI = FF.UI, $ = UI.$;
  var STEP_MS = 1000 / C.TICK_RATE;

  var G = {
    level: null, sim: null, R: null,
    speed: 1, acc: 0, last: 0,
    tut: [], tutIdx: 0, endTimer: 0, endShown: false, humOn: false
  };

  /* ---------- Sessão ---------- */
  function openLevel(id) {
    var L = FF.levelById(id);
    if (L) openLevelObj(L);
  }
  function openLevelObj(L) {
    G.level = L;
    G.mode = L.mode || 'campaign';
    G.placements = {};
    UI.closeModal();
    UI.show('game');
    resetSim();
  }

  function resetSim() {
    var L = G.level;
    // montagem: o reinício mantém as peças que o jogador colocou (é o plano dele)
    G.sim = FF.Sim.create(L, L.build ? G.placements || {} : {});
    G.acc = 0;
    G.endTimer = 0; G.endShown = false;
    var done = G.mode === 'campaign' ? FF.Storage.levelResult(L.id) : true;
    G.tut = (!done && L.tutorial) ? L.tutorial : [];
    if (G.mode === 'endless' && !FF.Storage.extra().endlessBest) {
      G.tut = [{ text: 'A linha nunca para e o ritmo acelera a cada objeto. Até onde você aguenta?', until: 'start' }];
    }
    G.tutIdx = 0;
    UI.setHud(G.sim);
    UI.buildManifest(G.sim);
    resizeBoard();
    G.R.setSim(G.sim);
    showTutorialStep();
    refreshControls();
    setHum(false);
  }

  function showTutorialStep() {
    var step = G.tut[G.tutIdx] || null;
    UI.coach(step);
    var tile = -1;
    if (step && step.target) {
      var m = /^(device|bin|source):(\d+)$/.exec(step.target), mt = /^tile:(\d+),(\d+)$/.exec(step.target);
      if (mt) tile = +mt[2] * G.sim.F.w + +mt[1];
      if (m) {
        var F = G.sim.F, n = +m[2];
        var list = m[1] === 'device' ? F.devices : m[1] === 'bin' ? F.bins : F.sources;
        if (list[n]) tile = list[n].tile;
      }
    }
    G.R.coachTile = tile;
  }

  function tutorialEvent(type) {
    var step = G.tut[G.tutIdx];
    if (step && step.until === type) { G.tutIdx++; showTutorialStep(); refreshControls(); }
  }

  function startLocked() {
    var step = G.tut[G.tutIdx];
    return !!(step && step.lockStart && G.sim.status === 'planning');
  }

  function refreshControls() {
    var st = G.sim.status;
    UI.setMainButton(st, startLocked());
    var chip = null;
    if (G.level.build && st === 'planning') {
      var used = Object.keys(G.sim.placements).length;
      chip = 'Montagem: ' + used + ' de ' + G.level.build.pieces + ' peças. Toque nas vagas.';
    }
    UI.setStatusChip(st, G.sim.F.devices.length > 0, chip);
    $('btn-speed').textContent = G.speed + '×';
    $('btn-speed').setAttribute('aria-label', 'Velocidade ' + G.speed + 'x');
  }

  function mainAction() {
    var sim = G.sim;
    FF.Audio.resume();
    if (sim.status === 'planning') {
      if (startLocked()) return;
      FF.Sim.start(sim);
    } else if (sim.status === 'running') {
      FF.Sim.setPaused(sim, true);
    } else if (sim.status === 'paused') {
      FF.Sim.setPaused(sim, false);
    }
    refreshControls();
  }

  function restart() {
    FF.Audio.play('ui');
    UI.closeModal();
    if (G.mode === 'endless') G.level = FF.Modes.endlessLevel(); // nova ordem de cores
    resetSim();
  }

  function setHum(on) { if (on !== G.humOn) { G.humOn = on; FF.Audio.setHum(on); } }

  /* ---------- Entrada por toque ---------- */
  function onBoardPointer(e) {
    if (!G.sim || UI.modalOpen()) return;
    FF.Audio.resume();
    var rect = G.R.cv.getBoundingClientRect(), R = G.R, F = G.sim.F;
    var gx = Math.floor((e.clientX - rect.left - R.ox) / R.ts), gy = Math.floor((e.clientY - rect.top - R.oy) / R.ts);
    if (gx < 0 || gy < 0 || gx >= F.w || gy >= F.h) return;
    var idx = gy * F.w + gx;
    if (G.sim.status === 'planning' && F.slots && F.slots.indexOf(idx) >= 0) { e.preventDefault(); cycleSlot(idx); return; }
    var t = F.tiles[idx];
    if (!t || t.dev < 0) return;
    e.preventDefault();
    if (FF.Sim.toggle(G.sim, t.dev)) FF.Haptics.buzz('tap');
  }

  /* Montagem: tocar numa vaga coloca uma esteira; tocar de novo gira (↑ → ↓ ←); depois remove. */
  function cycleSlot(idx) {
    var pl = Object.assign({}, G.sim.placements), cur = pl[idx];
    var used = Object.keys(pl).length, max = G.level.build ? G.level.build.pieces : 0;
    if (cur === undefined) {
      if (used >= max) {
        FF.Audio.play('wrong'); FF.Haptics.buzz('warn');
        UI.toast('Sem peças sobrando. Toque numa esteira colocada para girar ou remover.');
        return;
      }
      pl[idx] = 0;
    } else if (cur < 3) pl[idx] = cur + 1;
    else delete pl[idx];
    var old = G.sim;
    G.sim = FF.Sim.create(G.level, pl);
    G.sim.dev = old.dev.slice();
    G.sim.planTaps = old.planTaps;
    G.placements = pl;
    G.R.setSim(G.sim);
    FF.Audio.play('toggle'); FF.Haptics.buzz('tap');
    tutorialEvent('place');
    refreshControls();
  }

  /* ---------- Eventos da simulação -> áudio, efeitos, UI ---------- */
  function drainEvents() {
    var sim = G.sim, evs = sim.events;
    if (!evs.length) return;
    sim.events = [];
    for (var i = 0; i < evs.length; i++) {
      var ev = evs[i];
      G.R.onEvent(ev);
      switch (ev.type) {
        case 'start': FF.Audio.play('start'); tutorialEvent('start'); break;
        case 'toggle': FF.Audio.play(sim.F.devices[ev.dev].type === 'gate' ? 'gate' : 'toggle'); tutorialEvent('toggle'); break;
        case 'gateOpen': FF.Audio.play('gateOpen'); break;
        case 'cycle': FF.Audio.play('cycle'); break;
        case 'refused': FF.Audio.play('wrong'); FF.Haptics.buzz('warn'); UI.toast('Esvazie a esteira antes de inverter o sentido.'); break;
        case 'paint': FF.Audio.play('paint'); break;
        case 'deliver': FF.Audio.play('deliver', ev.cat); UI.updateCount(sim); tutorialEvent('deliver'); break;
        case 'warn': FF.Audio.play('warn'); FF.Haptics.buzz('warn'); break;
        case 'wrong': FF.Audio.play('wrong'); break;
        case 'win': FF.Audio.play('win'); FF.Haptics.buzz('win'); tutorialEvent('win'); break;
        case 'fail': if (ev.reason !== 'wrong') FF.Audio.play('fail'); FF.Haptics.buzz('fail'); break;
      }
    }
    UI.updateManifest(sim);
    refreshControls();
  }

  /* ---------- Fim de fase ---------- */
  var CAT_NAME = function (k) { return FF.CATS[k] ? FF.CATS[k].name.toLowerCase() : k; };

  function showDailyWin() {
    var sim = G.sim, L = G.level, ev = FF.Sim.evaluate(sim);
    var prev = FF.Modes.dailyStatus().stars;
    FF.Storage.recordDaily(L.dateKey, ev.stars);
    var x = FF.Storage.extra();
    var crit = ev.criteria.map(function (c) {
      return '<li class="' + (c.ok ? 'ok' : 'no') + '">' + (c.ok ? UI.ICON.check : UI.ICON.cross) + '<span>' + c.label + '</span></li>';
    }).join('');
    UI.openModal(
      '<div class="win-head"><span class="kicker">' + L.subtitle + '</span><h2>Desafio do dia concluído</h2></div>' +
      '<div class="big-stars" id="big-stars">' + UI.starsHtml(0, 'bst') + '</div>' +
      '<div class="stats"><div><b>' + sim.delivered + '/' + sim.total + '</b><span>entregues</span></div>' +
      '<div><b>' + ev.taps + '</b><span>intervenções</span></div>' +
      '<div><b>' + x.dailyCount + '</b><span>dia' + (x.dailyCount === 1 ? '' : 's') + ' concluído' + (x.dailyCount === 1 ? '' : 's') + '</span></div></div>' +
      '<ul class="criteria">' + crit + '</ul>' +
      (prev > ev.stars ? '<p class="fine">Seu melhor hoje: ' + prev + ' estrela' + (prev > 1 ? 's' : '') + '</p>' : '') +
      '<p class="fine">Amanhã tem outro desafio.</p>' +
      '<div class="row2"><button class="btn" data-act="retry">Repetir</button><button class="btn btn-primary" data-act="menu">Menu</button></div>',
      { cls: 'win' }
    );
    lightStars(ev.stars);
  }

  function lightStars(n) {
    var stars = document.querySelectorAll('#big-stars .bst');
    for (var i = 0; i < n; i++) {
      (function (k) {
        setTimeout(function () { if (stars[k]) { stars[k].classList.add('on'); FF.Audio.play('star', k); } }, 250 + k * 280);
      })(i);
    }
  }

  function showEndlessEnd() {
    var sim = G.sim, score = sim.delivered;
    var prevBest = FF.Storage.extra().endlessBest || 0;
    var rec = FF.Storage.recordEndless(score);
    var f = sim.fail || {};
    var why = f.reason === 'wrong' ? 'Um objeto ' + CAT_NAME(f.cat) + ' entrou no recipiente ' + CAT_NAME(f.binCat) + '.'
      : f.reason === 'overload' ? 'A linha encheu e o depósito da fonte lotou.' : 'A fábrica parou.';
    UI.openModal(
      '<div class="win-head"><span class="kicker">Modo infinito</span><h2>' + (rec ? 'Novo recorde!' : 'Fim do turno') + '</h2></div>' +
      '<p class="lead">' + why + '</p>' +
      '<div class="stats"><div><b>' + score + '</b><span>entregues</span></div>' +
      '<div><b>' + (sim.tick / C.TICK_RATE).toFixed(0) + ' s</b><span>tempo</span></div>' +
      '<div><b>' + Math.max(score, prevBest) + '</b><span>recorde</span></div></div>' +
      '<button class="btn btn-primary" data-act="retry">Jogar de novo</button>' +
      '<button class="btn" data-act="menu">Menu</button>',
      { cls: rec ? 'win' : 'fail' }
    );
    if (rec) FF.Audio.play('star', 2);
  }

  function showWin() {
    if (G.mode === 'daily') { showDailyWin(); return; }
    var sim = G.sim, L = G.level, ev = FF.Sim.evaluate(sim);
    var prev = FF.Storage.levelResult(L.id);
    FF.Storage.recordWin(L.id, ev.stars, ev.taps, ev.seconds);
    var idx = FF.levelIndex(L.id), next = FF.LEVELS[idx + 1];
    var nextChapter = next && next.chapter !== L.chapter;
    var crit = ev.criteria.map(function (c) {
      return '<li class="' + (c.ok ? 'ok' : 'no') + '">' + (c.ok ? UI.ICON.check : UI.ICON.cross) + '<span>' + c.label + '</span></li>';
    }).join('');
    var best = prev && prev.stars > ev.stars ? '<p class="fine">Seu recorde nesta fase: ' + prev.stars + ' estrela' + (prev.stars > 1 ? 's' : '') + '</p>' : '';
    UI.openModal(
      '<div class="win-head"><span class="kicker">Fase ' + L.id + '</span><h2>Turno concluído</h2></div>' +
      '<div class="big-stars" id="big-stars">' + UI.starsHtml(0, 'bst') + '</div>' +
      '<div class="stats"><div><b>' + sim.delivered + '/' + sim.total + '</b><span>entregues</span></div>' +
      '<div><b>' + ev.seconds.toFixed(1).replace('.', ',') + ' s</b><span>tempo</span></div>' +
      '<div><b>' + ev.taps + '</b><span>intervenções</span></div></div>' +
      '<ul class="criteria">' + crit + '</ul>' + best +
      (next ? '<button class="btn btn-primary" data-act="next">' + (nextChapter ? 'Próximo capítulo' : 'Próxima fase') + '</button>'
        : '<p class="fine">Você concluiu todas as fases disponíveis nesta versão.</p>') +
      '<div class="row2"><button class="btn" data-act="retry">Repetir</button><button class="btn" data-act="levels">Fases</button></div>',
      { cls: 'win' }
    );
    lightStars(ev.stars); // estrelas acendem uma a uma
  }

  function showFail() {
    if (G.mode === 'endless') { showEndlessEnd(); return; }
    var f = G.sim.fail || {}, title, body;
    var F = G.sim.F;
    switch (f.reason) {
      case 'wrong':
        title = 'Recipiente errado';
        body = 'Um objeto ' + CAT_NAME(f.cat) + ' entrou no recipiente ' + CAT_NAME(f.binCat) + '. Troque o desviador antes que o objeto entre nele.';
        break;
      case 'overload':
        var S = F.sources[f.src];
        title = 'Linha ' + S.label + ' sobrecarregada';
        body = 'A esteira encheu e o depósito da fonte ' + S.label + ' lotou. O anel vermelho marca a fonte e o início da fila.';
        break;
      case 'gridlock':
        title = 'Fábrica travada';
        body = 'Nenhum objeto se move há 5 segundos. O anel vermelho marca onde a fila parou.';
        break;
      default:
        title = 'Tempo esgotado';
        body = 'A produção não terminou a tempo.';
    }
    // o painel não pode cobrir o problema que ele aponta
    var top = false;
    if (f.tile >= 0) {
      var c = G.R.tileCenter(f.tile), r = G.R.cv.getBoundingClientRect();
      top = (r.top + c.y) > window.innerHeight * 0.5;
    }
    UI.openModal(
      '<h2>' + title + '</h2><p class="lead">' + body + '</p>' +
      '<button class="btn btn-primary" data-act="retry">Tentar novamente</button>' +
      (G.mode === 'campaign' ? '<button class="btn" data-act="levels">Voltar às fases</button>' : '<button class="btn" data-act="menu">Menu</button>'),
      { cls: 'fail', bottom: !top, top: top }
    );
  }

  function openPause() {
    if (G.sim.status === 'running') FF.Sim.setPaused(G.sim, true);
    refreshControls();
    UI.openModal(
      '<h2>Pausado</h2>' +
      '<button class="btn btn-primary" data-act="resume">Continuar</button>' +
      '<button class="btn" data-act="retry">Reiniciar fase</button>' +
      '<button class="btn" data-act="settings">Configurações</button>' +
      '<button class="btn" data-act="menu">Menu principal</button>',
      { cls: 'pause', onBackdrop: resumeFromPause, kind: 'pause' }
    );
  }

  function resumeFromPause() {
    UI.closeModal();
    if (G.sim && G.sim.status === 'paused') FF.Sim.setPaused(G.sim, false);
    refreshControls();
  }

  function openSettings(from) {
    UI.openModal(UI.settingsHtml(), { cls: 'settings', kind: 'settings', from: from, onBackdrop: function () { closeSettings(from); } });
  }
  function closeSettings(from) { if (from === 'pause') openPause(); else UI.closeModal(); }

  /* ---------- Código de transferência ---------- */
  function codeMsg(text, kind) {
    var m = $('code-msg');
    if (!m) return;
    m.textContent = text;
    m.className = 'code-msg' + (kind ? ' ' + kind : '');
  }
  function copyCode() {
    var code = FF.Transfer.encode();
    var from = (UI.modalOpts() || {}).from;
    UI.openModal(UI.codeCopyHtml(code), { cls: 'settings', kind: 'code', from: from, onBackdrop: function () { openSettings(from); } });
    FF.Native.copyText(code).then(function (ok) {
      codeMsg(ok ? 'Copiado. Agora é só colar onde quiser guardar.' : 'Não deu para copiar sozinho. Toque e segure o código para copiar.', ok ? 'ok' : 'err');
    });
  }
  function openPaste() {
    var from = (UI.modalOpts() || {}).from;
    UI.openModal(UI.codePasteHtml(), { cls: 'settings', kind: 'code', from: from, onBackdrop: function () { openSettings(from); } });
  }
  function pasteFromClipboard() {
    FF.Native.readText().then(function (t) {
      var box = $('code-input');
      if (!box) return;
      if (!t) { codeMsg('A área de transferência está vazia.', 'err'); return; }
      box.value = String(t).trim();
      codeMsg('');
    }, function () { codeMsg('Sem acesso à área de transferência. Toque e segure no campo para colar.', 'err'); });
  }
  function restoreCode() {
    var box = $('code-input');
    if (!box) return;
    if (!box.value.trim()) { codeMsg('Cole o código no campo acima.', 'err'); return; }
    var d = FF.Transfer.decode(box.value);
    if (!d.ok) { codeMsg(d.error, 'err'); FF.Audio.play('fail'); return; }
    var r = FF.Transfer.apply(d);
    UI.renderMenu();
    if (UI.current() === 'chapters') UI.renderChapters();
    FF.Audio.play('star', 2);
    codeMsg('Progresso recuperado: ' + r.done + ' fases concluídas, ' + r.stars + ' estrelas.' +
      (r.improved ? '' : ' Este aparelho já tinha tudo isso.'), 'ok');
  }

  function applySettings() {
    FF.Audio.setMusic(FF.Storage.setting('music'));
    FF.Audio.setSfx(FF.Storage.setting('sfx'));
  }

  /* ---------- Ações de botões (delegação) ---------- */
  function onAction(act) {
    FF.Audio.resume();
    switch (act) {
      case 'next': {
        var i = FF.levelIndex(G.level.id), next = FF.LEVELS[i + 1];
        if (next) openLevel(next.id);
        break;
      }
      case 'retry': restart(); break;
      case 'levels': UI.closeModal(); setHum(false); UI.show('chapters'); break;
      case 'menu': UI.closeModal(); setHum(false); UI.show('menu'); break;
      case 'resume': FF.Audio.play('ui'); resumeFromPause(); break;
      case 'settings': FF.Audio.play('ui'); openSettings('pause'); break;
      case 'code-copy': FF.Audio.play('ui'); copyCode(); break;
      case 'code-copy-again': {
        var c = $('code-box');
        if (c) FF.Native.copyText(c.textContent).then(function (ok) { codeMsg(ok ? 'Copiado de novo.' : 'Toque e segure o código para copiar.', ok ? 'ok' : 'err'); });
        break;
      }
      case 'code-paste': FF.Audio.play('ui'); openPaste(); break;
      case 'code-from-clipboard': pasteFromClipboard(); break;
      case 'code-restore': restoreCode(); break;
      case 'code-back': { var oc = UI.modalOpts(); FF.Audio.play('ui'); openSettings(oc && oc.from); break; }
      case 'settings-close': {
        var o = UI.modalOpts();
        FF.Audio.play('ui');
        closeSettings(o && o.from);
        break;
      }
    }
  }

  function bindUI() {
    $('btn-play').addEventListener('click', function () {
      FF.Audio.resume(); FF.Audio.play('ui');
      var id = FF.Storage.nextLevelId() || FF.LEVELS[0].id;
      openLevel(id);
    });
    $('btn-levels').addEventListener('click', function () { FF.Audio.resume(); FF.Audio.play('ui'); UI.show('chapters'); });
    $('btn-settings').addEventListener('click', function () { FF.Audio.resume(); FF.Audio.play('ui'); openSettings('menu'); });
    document.querySelectorAll('[data-nav]').forEach(function (b) {
      b.addEventListener('click', function () { FF.Audio.play('ui'); UI.show(b.dataset.nav); });
    });
    $('chapters').addEventListener('click', function (e) {
      var b = e.target.closest('[data-level]');
      if (!b || b.disabled) return;
      FF.Audio.resume(); FF.Audio.play('ui');
      openLevel(b.dataset.level);
    });
    $('btn-hud-back').addEventListener('click', function () { FF.Audio.play('ui'); setHum(false); UI.show(G.mode === 'campaign' ? 'chapters' : 'menu'); });
    $('btn-daily').addEventListener('click', function () { FF.Audio.resume(); FF.Audio.play('ui'); openLevelObj(FF.Modes.dailyLevel()); });
    $('btn-endless').addEventListener('click', function () { FF.Audio.resume(); FF.Audio.play('ui'); openLevelObj(FF.Modes.endlessLevel()); });
    $('btn-pause').addEventListener('click', function () { FF.Audio.resume(); FF.Audio.play('ui'); openPause(); });
    $('btn-main').addEventListener('click', mainAction);
    $('btn-restart').addEventListener('click', restart);
    $('btn-speed').addEventListener('click', function () {
      FF.Audio.play('ui');
      G.speed = G.speed === 1 ? 2 : 1;
      refreshControls();
    });
    $('board').addEventListener('pointerdown', onBoardPointer);
    $('modal').addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (b) onAction(b.dataset.act);
    });
    $('modal').addEventListener('change', function (e) {
      var k = e.target.dataset && e.target.dataset.setting;
      if (!k) return;
      FF.Storage.setting(k, e.target.checked);
      applySettings();
      if (k === 'vibration' && e.target.checked) FF.Haptics.buzz('tap');
      if (k === 'sfx' && e.target.checked) FF.Audio.play('toggle');
    });
    var resetArmed = false;
    $('modal').addEventListener('click', function (e) {
      if (!e.target.closest('#btn-reset')) return;
      var b = $('btn-reset');
      if (!resetArmed) { resetArmed = true; b.textContent = 'Toque de novo para confirmar'; setTimeout(function () { resetArmed = false; if (b.isConnected) b.textContent = 'Apagar progresso'; }, 3000); return; }
      resetArmed = false;
      FF.Storage.reset();
      b.textContent = 'Progresso apagado';
      b.disabled = true;
      UI.renderMenu();
    });
    document.addEventListener('keydown', function (e) {
      if (UI.current() !== 'game' || UI.modalOpen()) return;
      if (e.code === 'Space') { e.preventDefault(); mainAction(); }
      if (e.key === 'r' || e.key === 'R') restart();
      var n = parseInt(e.key, 10);
      if (n >= 1 && n <= G.sim.F.devices.length) FF.Sim.toggle(G.sim, n - 1);
    });

    // App em segundo plano: pausa a produção e o áudio
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (G.sim && G.sim.status === 'running' && UI.current() === 'game') openPause();
        FF.Audio.suspend();
      }
    });
    window.addEventListener('resize', resizeBoard);
    if (window.ResizeObserver) new ResizeObserver(resizeBoard).observe($('board-wrap'));

    // App Android: Voltar e segundo plano
    FF.Native.init({
      back: onBack,
      hide: function () {
        if (G.sim && G.sim.status === 'running' && UI.current() === 'game') openPause();
        FF.Audio.suspend();
      },
      resume: function () { FF.Audio.resume(); }
    });
    // No navegador, Esc faz o papel do Voltar
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') onBack(); });
  }

  function onBack(exitApp) {
    if (UI.modalOpen()) {
      var o = UI.modalOpts();
      if (o && o.kind === 'pause') resumeFromPause();
      else if (o && o.kind === 'settings') closeSettings(o.from);
      else if (o && o.kind === 'code') openSettings(o.from);
      else { UI.closeModal(); setHum(false); UI.show(G.mode && G.mode !== 'campaign' ? 'menu' : 'chapters'); }
      return;
    }
    var cur = UI.current();
    if (cur === 'game') { if (G.sim.status === 'running' || G.sim.status === 'planning' || G.sim.status === 'paused') openPause(); }
    else if (cur === 'chapters') UI.show('menu');
    else if (exitApp) exitApp();
  }

  function resizeBoard() {
    var w = $('board-wrap');
    if (!G.R || !w) return;
    var r = w.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) G.R.resize(r.width, r.height);
  }

  /* ---------- Laço principal ---------- */
  function frame(now) {
    requestAnimationFrame(frame);
    var dtMs = G.last ? Math.min(100, now - G.last) : STEP_MS;
    G.last = now;
    if (UI.current() === 'menu') FF.LogoBelt && FF.LogoBelt.draw(dtMs / 1000);
    if (UI.current() !== 'game' || !G.sim) return;
    var sim = G.sim;
    var running = sim.status === 'running';
    if (running) {
      G.acc += dtMs * G.speed;
      var n = 0;
      while (G.acc >= STEP_MS && n < 12 && sim.status === 'running') { FF.Sim.step(sim); G.acc -= STEP_MS; n++; }
      if (n === 12) G.acc = 0;
    } else {
      G.acc = 0;
    }
    drainEvents();
    setHum(sim.status === 'running');
    G.R.draw(dtMs / 1000, running ? G.acc / STEP_MS : 1, sim.status === 'running', G.speed);

    if ((sim.status === 'won' || sim.status === 'failed') && !G.endShown) {
      G.endTimer += dtMs;
      UI.coach(null); G.R.coachTile = -1;
      if (G.endTimer > (sim.status === 'won' ? 900 : 1100)) {
        G.endShown = true;
        setHum(false);
        if (sim.status === 'won') showWin(); else showFail();
      }
    }
  }

  /* ---------- Logo animado do menu ---------- */
  FF.LogoBelt = (function () {
    var cv, ctx, t = 0, w = 0, h = 0, dpr = 1;
    var cats = ['R', 'B', 'Y', 'G'];
    function size() {
      cv = $('logo-belt'); if (!cv) return;
      var r = cv.getBoundingClientRect();
      dpr = Math.min(globalThis.devicePixelRatio || 1, 2.5);
      w = r.width; h = r.height;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      ctx = cv.getContext('2d');
    }
    function draw(dt) {
      if (!cv) size();
      if (!ctx || !w) { size(); if (!w) return; }
      t += dt;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      var y = h * 0.55, bh = h * 0.5;
      ctx.fillStyle = FF.PALETTE.rail;
      ctx.fillRect(0, y - bh * 0.6, w, bh * 1.2);
      ctx.fillStyle = FF.PALETTE.belt;
      ctx.fillRect(0, y - bh * 0.48, w, bh * 0.96);
      var gap = bh * 0.9, off = (t * bh * 1.6) % gap;
      ctx.strokeStyle = FF.PALETTE.chevron; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (var x = -gap + off; x < w + gap; x += gap) {
        ctx.beginPath(); ctx.moveTo(x - bh * 0.12, y - bh * 0.22); ctx.lineTo(x + bh * 0.1, y); ctx.lineTo(x - bh * 0.12, y + bh * 0.22); ctx.stroke();
      }
      var spacing = bh * 2.6, o2 = (t * bh * 1.6) % (spacing * cats.length);
      for (var k = -1; k < w / spacing + 2; k++) {
        var ix = k * spacing + (o2 % spacing);
        var cat = cats[((k - Math.floor(o2 / spacing)) % 4 + 4) % 4];
        FF.Draw.item(ctx, cat, ix, y, bh * 0.62);
      }
    }
    window.addEventListener('resize', function () { size(); });
    return { draw: draw, size: size };
  })();

  /* ---------- Inicialização ---------- */
  function boot() {
    FF.Storage.load();
    G.R = new FF.Renderer($('board'));
    bindUI();
    applySettings();
    UI.show('menu');
    $('version').textContent = 'v' + C.VERSION;
    // As fontes podem chegar depois do primeiro desenho
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { FF.LogoBelt.size(); });
    requestAnimationFrame(frame);
    // Desbloqueia o áudio no primeiro toque em qualquer lugar
    document.addEventListener('pointerdown', function once() {
      FF.Audio.resume();
      document.removeEventListener('pointerdown', once);
    });
    // Offline no navegador (no app Capacitor os arquivos já são locais)
    // (no app Android NÃO: o cache poderia servir arquivos antigos depois de uma atualização)
    if (!FF.BUNDLED && !FF.Native.isNative() && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }

  FF.Game = G; // exposto para testes automatizados
  FF.Game.openLevel = openLevel;
  FF.Game.back = onBack;
  FF.Game.openLevelObj = openLevelObj;
  FF.Game.reset = resetSim;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(globalThis.FF = globalThis.FF || {});
