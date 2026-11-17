/* FLOW FACTORY — ui.js
 * Telas e componentes de interface (DOM). A lógica de jogo fica em main.js.
 */
(function (FF) {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

  var ICON = {
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10-6.5z" fill="currentColor"/></svg>',
    restart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12a7 7 0 1 0 2.1-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M6 3v4.5h4.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" fill="currentColor"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    cross: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>'
  };

  function shapeSvg(cat, size) {
    var c = FF.CATS[cat], s = size || 16, body;
    switch (c.shape) {
      case 'circle': body = '<circle cx="12" cy="12" r="8.5"/>'; break;
      case 'square': body = '<rect x="4.5" y="4.5" width="15" height="15" rx="2.6"/>'; break;
      case 'triangle': body = '<path d="M12 3.2l9.2 16H2.8z" stroke-linejoin="round"/>'; break;
      default: body = '<path d="M12 2.5l9.5 9.5-9.5 9.5L2.5 12z" stroke-linejoin="round"/>';
    }
    return '<svg class="shape" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" aria-label="' + c.name +
      '"><g fill="' + c.color + '" stroke="' + c.dark + '" stroke-width="2">' + body + '</g></svg>';
  }

  function starsHtml(n, cls) {
    var h = '';
    for (var i = 0; i < 3; i++) h += '<span class="' + (cls || 'st') + (i < n ? ' on' : '') + '">' + ICON.star + '</span>';
    return h;
  }

  /* ---------- Telas ---------- */
  var current = 'menu';
  function show(name) {
    ['menu', 'chapters', 'game'].forEach(function (n) {
      $('scr-' + n).classList.toggle('active', n === name);
    });
    current = name;
    if (name === 'menu') renderMenu();
    if (name === 'chapters') renderChapters();
  }

  function renderMenu() {
    var t = FF.Storage.totals();
    var next = FF.Storage.nextLevelId();
    $('menu-progress').innerHTML =
      '<div class="prog-stars">' + ICON.star + '<b>' + t.stars + '</b><span>de ' + t.maxStars + ' estrelas</span></div>' +
      '<div class="prog-bar"><i style="width:' + Math.round(100 * t.done / t.total) + '%"></i></div>' +
      '<div class="prog-levels">' + t.done + ' de ' + t.total + ' fases concluídas</div>';
    var btn = $('btn-play');
    if (t.done === 0) btn.textContent = 'Jogar';
    else if (next) btn.textContent = 'Continuar: fase ' + next;
    else btn.textContent = 'Rejogar fases';
  }

  function renderChapters() {
    var t = FF.Storage.totals();
    $('chap-stars').innerHTML = ICON.star + ' ' + t.stars + '/' + t.maxStars;
    var html = '';
    FF.CHAPTERS.forEach(function (ch) {
      var levels = FF.LEVELS.filter(function (L) { return L.chapter === ch.id; });
      var unlocked = levels.length && FF.Storage.isUnlocked(levels[0].id);
      var stars = 0, done = 0;
      levels.forEach(function (L) { var r = FF.Storage.levelResult(L.id); if (r && r.done) { done++; stars += r.stars; } });
      html += '<article class="chapter' + (unlocked ? '' : ' locked') + '">' +
        '<header><span class="ch-num">Capítulo ' + ch.id + '</span><h3>' + ch.name + '</h3>' +
        '<p>' + ch.subtitle + '</p>' +
        '<div class="ch-meta">' + (unlocked ? ('<span>' + done + '/' + levels.length + ' fases</span><span>' + ICON.star + stars + '/' + levels.length * 3 + '</span>')
          : 'Conclua o capítulo anterior para desbloquear') + '</div></header>' +
        '<div class="level-grid">';
      levels.forEach(function (L) {
        var r = FF.Storage.levelResult(L.id), open = FF.Storage.isUnlocked(L.id);
        html += '<button class="lvl' + (open ? '' : ' locked') + (r && r.done ? ' done' : '') + '" data-level="' + L.id + '"' +
          (open ? '' : ' disabled aria-disabled="true"') + ' aria-label="Fase ' + L.id + ' ' + L.name + '">' +
          '<span class="lvl-code">' + L.id + '</span>' +
          (open ? '<span class="lvl-name">' + L.name + '</span><span class="lvl-stars">' + starsHtml(r ? r.stars : 0) + '</span>'
            : '<span class="lvl-lock">' + ICON.lock + '</span>') +
          '</button>';
      });
      html += '</div></article>';
    });
    $('chapters').innerHTML = html;
  }

  /* ---------- HUD ---------- */
  var manifestState = [];
  function buildManifest(sim) {
    var html = '';
    manifestState = [];
    sim.F.sources.forEach(function (S, i) {
      html += '<div class="mf-row" id="mf-' + i + '"><span class="mf-label">' + S.label + '</span><div class="mf-seq">';
      S.seq.forEach(function (c, k) { html += '<span class="mf-item" data-k="' + k + '">' + shapeSvg(c, 18) + '</span>'; });
      html += '</div><span class="mf-left" id="mf-left-' + i + '"></span></div>';
      manifestState.push(-1);
    });
    $('manifest').innerHTML = html;
    updateManifest(sim);
  }

  function updateManifest(sim) {
    sim.F.sources.forEach(function (S, i) {
      var idx = sim.src[i].idx;
      if (manifestState[i] === idx) return;
      manifestState[i] = idx;
      var items = $('mf-' + i).querySelectorAll('.mf-item');
      for (var k = 0; k < items.length; k++) {
        items[k].classList.toggle('gone', k < idx);
        items[k].classList.toggle('next', k === idx);
      }
      var left = S.seq.length - idx;
      $('mf-left-' + i).textContent = left > 1 ? left + ' restam' : left === 1 ? '1 resta' : 'concluída';
      var nx = items[idx];
      if (nx && nx.scrollIntoView && nx.parentNode.scrollWidth > nx.parentNode.clientWidth) {
        nx.parentNode.scrollLeft = Math.max(0, nx.offsetLeft - 40);
      }
    });
  }

  function setHud(sim) {
    $('hud-code').textContent = sim.level.id;
    $('hud-name').textContent = sim.level.name;
    updateCount(sim);
  }

  function updateCount(sim) {
    $('hud-count').innerHTML = '<b>' + sim.delivered + '</b>/' + sim.total + '<span>entregues</span>';
  }

  function setMainButton(status, locked) {
    var b = $('btn-main');
    var map = {
      planning: [ICON.play + '<span>Iniciar</span>', 'start'],
      running: [ICON.pause + '<span>Pausar</span>', 'pause'],
      paused: [ICON.play + '<span>Continuar</span>', 'resume']
    };
    var m = map[status];
    if (!m) { b.disabled = true; return; }
    if (b.dataset.mode !== status) { b.innerHTML = m[0]; b.dataset.mode = status; }
    b.disabled = !!locked;
    b.classList.toggle('is-running', status === 'running');
  }

  function setStatusChip(status, hasDevices) {
    var el = $('status-chip');
    var txt = {
      planning: hasDevices ? 'Planejamento: ajuste os desviadores' : 'Planejamento: produção parada',
      paused: hasDevices ? 'Pausado: você ainda pode trocar os desviadores' : 'Pausado'
    }[status] || '';
    el.textContent = txt;
    el.classList.toggle('show', !!txt);
  }

  /* ---------- Tutorial (balão curto) ---------- */
  function coach(step) {
    var el = $('coach');
    document.querySelectorAll('.coach-pulse').forEach(function (n) { n.classList.remove('coach-pulse'); });
    if (!step) { el.classList.add('hidden'); return; }
    el.textContent = step.text;
    el.classList.remove('hidden');
    var t = step.target || '';
    var btnTarget = { start: 'btn-main', pause: 'btn-main', manifest: 'manifest' }[t];
    if (btnTarget) $(btnTarget).classList.add('coach-pulse');
    el.classList.toggle('at-top', t === 'manifest' || t.indexOf('bin:') === 0);
  }

  /* ---------- Modais ---------- */
  var modalStack = [];
  function openModal(html, opts) {
    opts = opts || {};
    var m = $('modal'), sh = $('sheet');
    sh.innerHTML = html;
    sh.className = 'sheet' + (opts.cls ? ' ' + opts.cls : '');
    m.className = 'modal' + (opts.bottom ? ' bottom' : '') + (opts.top ? ' top' : '');
    m.onclick = function (e) { if (e.target === m && opts.onBackdrop) opts.onBackdrop(); };
    modalStack = [opts];
    var first = sh.querySelector('button');
    if (first && first.focus) setTimeout(function () { first.focus({ preventScroll: true }); }, 30);
  }
  function closeModal() { $('modal').className = 'modal hidden'; $('sheet').innerHTML = ''; modalStack = []; }
  function modalOpen() { return !$('modal').classList.contains('hidden'); }
  function modalOpts() { return modalStack[0] || null; }

  function settingsHtml() {
    var S = FF.Storage, vib = FF.Haptics.supported();
    function row(key, label, desc, disabled) {
      var on = !!S.setting(key) && !disabled;
      return '<label class="toggle' + (disabled ? ' disabled' : '') + '"><span><b>' + label + '</b><small>' + desc + '</small></span>' +
        '<input type="checkbox" data-setting="' + key + '"' + (on ? ' checked' : '') + (disabled ? ' disabled' : '') + '><i></i></label>';
    }
    return '<h2>Configurações</h2>' +
      row('music', 'Música', 'Trilha ambiente da fábrica') +
      row('sfx', 'Efeitos sonoros', 'Desviadores, entregas e alertas') +
      row('vibration', 'Vibração', vib ? 'Resposta tátil ao tocar e em alertas' : 'Não disponível neste aparelho', !vib) +
      '<button class="btn btn-ghost danger" id="btn-reset">Apagar progresso</button>' +
      '<button class="btn btn-primary" data-act="settings-close">Pronto</button>' +
      '<p class="fine">FLOW FACTORY v' + FF.CONFIG.VERSION + '</p>';
  }

  FF.UI = {
    $: $, ICON: ICON, shapeSvg: shapeSvg, starsHtml: starsHtml,
    show: show, current: function () { return current; },
    renderMenu: renderMenu, renderChapters: renderChapters,
    buildManifest: buildManifest, updateManifest: updateManifest, setHud: setHud, updateCount: updateCount,
    setMainButton: setMainButton, setStatusChip: setStatusChip, coach: coach,
    openModal: openModal, closeModal: closeModal, modalOpen: modalOpen, modalOpts: modalOpts,
    settingsHtml: settingsHtml
  };
})(globalThis.FF = globalThis.FF || {});
