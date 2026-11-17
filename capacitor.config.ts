import type { CapacitorConfig } from '@capacitor/cli';

/**
 * FLOW FACTORY — configuração do Capacitor.
 *
 * ATENÇÃO: não mude `appId` nem `server.androidScheme` depois de publicar.
 * O progresso fica no localStorage da origem https://localhost; trocar a origem faz o
 * jogador "perder" o progresso salvo.
 */
const config: CapacitorConfig = {
  appId: 'com.gridmind.flowfactory',
  appName: 'FLOW FACTORY',
  webDir: 'www',
  // fundo do WebView enquanto o jogo carrega (evita flash branco)
  backgroundColor: '#070c1a',
  server: {
    androidScheme: 'https'
  },
  android: {
    // o jogo é offline: não carrega nada de fora
    allowMixedContent: false,
    captureInput: false,
    webContentsDebuggingEnabled: false
  },
  plugins: {
    SystemBars: {
      // injeta --safe-area-inset-* corretos (usados no CSS do jogo)
      insetsHandling: 'css',
      // fundo escuro → ícones claros nas barras do sistema
      style: 'DARK',
      hidden: false
    }
  }
};

export default config;
