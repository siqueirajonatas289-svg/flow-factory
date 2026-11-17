/* FLOW FACTORY — native.js
 * Integração com o app Android (Capacitor). No navegador comum nada muda:
 * o jogo continua 100% web.
 * No Android: botão Voltar, pausa ao ir para segundo plano, vibração nativa.
 */
(function (FF) {
  'use strict';
  var G = globalThis;

  function isNative() {
    try { return !!(G.Capacitor && G.Capacitor.isNativePlatform && G.Capacitor.isNativePlatform()); }
    catch (e) { return false; }
  }

  function appPlugin() {
    if (G.capacitorApp && G.capacitorApp.App) return G.capacitorApp.App;
    if (G.Capacitor && G.Capacitor.Plugins && G.Capacitor.Plugins.App) return G.Capacitor.Plugins.App;
    return null;
  }

  function hapticsPlugin() {
    if (G.capacitorHaptics && G.capacitorHaptics.Haptics) return G.capacitorHaptics.Haptics;
    if (G.Capacitor && G.Capacitor.Plugins && G.Capacitor.Plugins.Haptics) return G.Capacitor.Plugins.Haptics;
    return null;
  }

  function vibrationSupported() {
    return (isNative() && !!hapticsPlugin()) || !!(G.navigator && typeof G.navigator.vibrate === 'function');
  }

  /* Vibração única do jogo. No app usa o vibrador nativo (plugin Haptics), porque o
   * navigator.vibrate do WebView é ignorado em muitos aparelhos. Pulsos muito curtos
   * não são sentidos em vários motores: mínimo de 25 ms. */
  function vibrate(pattern) {
    var H = isNative() ? hapticsPlugin() : null;
    if (H) {
      var parts = Array.isArray(pattern) ? pattern : [pattern], t = 0;
      parts.forEach(function (ms, i) {
        if (i % 2 === 0) setTimeout(function () { try { H.vibrate({ duration: Math.max(25, ms) }); } catch (e) { /* ignora */ } }, t);
        t += ms;
      });
      return;
    }
    try { if (G.navigator && G.navigator.vibrate) G.navigator.vibrate(pattern); } catch (e) { /* sem suporte */ }
  }

  function init(handlers) {
    var native = isNative();
    document.documentElement.classList.toggle('native', native);
    if (!native) return;
    var App = appPlugin();
    if (!App) return;
    // ao registrar este ouvinte, o Capacitor deixa de fechar o app sozinho no Voltar
    App.addListener('backButton', function () { handlers.back(function () { App.exitApp(); }); });
    App.addListener('appStateChange', function (state) {
      if (state.isActive) handlers.resume(); else handlers.hide();
    });
  }

  FF.Native = { init: init, isNative: isNative, vibrate: vibrate, vibrationSupported: vibrationSupported };
})(globalThis.FF = globalThis.FF || {});
