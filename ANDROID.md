# FLOW FACTORY no Android

App: **FLOW FACTORY** · ID `com.gridmind.flowfactory` · Capacitor 8.6.2 · minSdk 24 (Android 7.0) · compileSdk/targetSdk 36 (Android 16) · retrato.

O jogo roda inteiro dentro do app (pasta `www/`, empacotada no APK). Não usa internet, servidores, anúncios nem coleta de dados.

---

## 1. Requisitos (uma vez só)

Escolha **um** dos caminhos:

**A. No seu computador**
- Node.js 22 ou mais novo
- Android Studio atual (inclui o JDK 21 e o Android SDK). No SDK Manager, instale **Android SDK Platform 36** e **Build-Tools**.

**B. Na nuvem (sem instalar nada além de uma conta no GitHub)**
- Suba esta pasta para um repositório no GitHub. Os workflows em `.github/workflows/` compilam lá.

---

## 2. APK de teste (debug)

### Caminho A: computador
```bash
npm install
npm run android:debug        # copia o jogo para o Android e compila
```
O APK sai em:
```
android/app/build/outputs/apk/debug/app-debug.apk
```
Para abrir no Android Studio: `npm run sync && npm run open`, depois **Build → Build App Bundle(s) / APK(s) → Build APK(s)**.

### Caminho B: GitHub Actions
1. Repositório → aba **Actions** → **Android — APK de teste** → **Run workflow**.
2. Ao terminar, abra a execução e baixe **flow-factory-debug-apk** em *Artifacts* (vem em .zip; o APK está dentro).

### Instalar no celular
- **Pelo arquivo:** envie o `app-debug.apk` para o celular, toque nele e permita *instalar apps desconhecidos* para o app que abriu o arquivo (Arquivos, Drive, navegador).
- **Pelo cabo (adb):** ative *Opções do desenvolvedor → Depuração USB* e rode `adb install -r app-debug.apk`.

A versão de teste aparece como **FLOW FACTORY (teste)** (`com.gridmind.flowfactory.debug`) e pode ficar instalada ao lado da versão da loja. Elas têm progresso separado.

### Roteiro de teste no aparelho
- [ ] Abre sem tela branca: splash escura com o emblema (esteira + desviador) e depois a tela inicial
- [ ] Barra de status e barra de navegação não cobrem botões (teste com navegação por gestos e por 3 botões)
- [ ] Jogar, tocar em desviadores, distribuidores e bloqueadores, Iniciar, Pausar, Reiniciar, 2×
- [ ] Som e música tocam depois do primeiro toque; os botões de som e música funcionam
- [ ] Vibração ao tocar nos dispositivos, nos alertas de sobrecarga, na vitória e na falha (se o aparelho tiver)
- [ ] **Voltar:** fases → início · fase → pausa · pausa → continua · configurações → fecha · vitória/falha → fases · início → sai do app
- [ ] Ir para a tela inicial do Android durante a produção: ao voltar, a fase está pausada e o som parou enquanto estava fora
- [ ] Fechar o app (inclusive pelos recentes) e reabrir: progresso e estrelas continuam lá
- [ ] Modo avião: tudo funciona
- [ ] Girar o aparelho: continua em retrato

---

## 3. Assinatura de produção (faça com calma, uma vez)

A Google Play usa o **Play App Signing**: o Google guarda a chave definitiva do app, e você assina os envios com uma **chave de upload** sua. Se perder a chave de upload, dá para pedir a troca no Play Console. Mesmo assim, faça backup.

### 3.1 Criar a chave de upload
Rode no seu computador, numa pasta **fora** do projeto:
```bash
keytool -genkeypair -v -keystore flowfactory-upload.jks -alias upload \
        -keyalg RSA -keysize 2048 -validity 10000
```
O `keytool` vem com o JDK do Android Studio. Ele pede senhas e seus dados (nome, organização, cidade, país): use dados **verdadeiros**.

Guarde em local seguro, por exemplo um gerenciador de senhas:
- o arquivo `flowfactory-upload.jks`, com cópia de backup fora do computador;
- a senha do keystore e a senha da chave.

Nunca envie o `.jks` nem as senhas para o GitHub, chats ou e-mail. O `.gitignore` do projeto já bloqueia `*.jks`, `*.keystore` e `keystore.properties`.

### 3.2 Gerar o AAB no seu computador
1. Copie `android/keystore.properties.example` para `android/keystore.properties` e preencha com o caminho do `.jks` e as senhas.
2. Rode:
   ```bash
   npm run android:bundle
   ```
3. O AAB assinado sai em:
   ```
   android/app/build/outputs/bundle/release/app-release.aab
   ```
Sem o `keystore.properties`, o Gradle avisa e gera o AAB **sem assinatura**, que a Play não aceita.

### 3.3 Ou gerar o AAB no GitHub Actions
Em **Settings → Secrets and variables → Actions**, crie:

| Secret | Valor |
|---|---|
| `FF_UPLOAD_KEYSTORE_BASE64` | saída de `base64 -w0 flowfactory-upload.jks` (no Mac: `base64 -i flowfactory-upload.jks`) |
| `FF_UPLOAD_STORE_PASSWORD` | senha do keystore |
| `FF_UPLOAD_KEY_ALIAS` | `upload` |
| `FF_UPLOAD_KEY_PASSWORD` | senha da chave |

Depois: **Actions → Android — AAB de produção → Run workflow** e baixe o artifact **flow-factory-release-aab**.

### 3.4 A cada nova versão
Em `android/app/build.gradle`, aumente `versionCode` (1 → 2 → 3…) e ajuste `versionName`. A Play recusa um `versionCode` repetido.

---

## 4. Publicar na Google Play (checklist)

- [ ] Conta de desenvolvedor no Play Console (taxa única).
- [ ] **Conta pessoal criada depois de 13/11/2023:** antes de liberar a produção, é obrigatório um **teste fechado com pelo menos 12 testadores, inscritos por 14 dias seguidos**. Planeje cerca de 3 semanas. Testes internos e abertos não contam.
- [ ] Criar o app: nome *FLOW FACTORY*, tipo **Jogo**, categoria **Quebra-cabeça**, gratuito.
- [ ] Enviar o `app-release.aab` (primeiro no teste fechado).
- [ ] Ficha da loja, com arquivos prontos em `resources/store/`:
  - ícone 512×512: `play-icon-512.png`
  - gráfico de destaque 1024×500: `feature-graphic-1024x500.png`
  - capturas de tela do celular (1080×1920): `screenshot-*.png`
- [ ] **Segurança dos dados:** o app não coleta nem compartilha dados. O progresso fica só no aparelho, no armazenamento local do app.
- [ ] Classificação de conteúdo (questionário): sem violência, sem compras, sem interação entre usuários.
- [ ] Público-alvo e anúncios: "não contém anúncios".
- [ ] Política de privacidade: recomendado ter uma página simples dizendo que o jogo não coleta dados. Ela vira obrigatória se o público-alvo incluir crianças.
- [ ] Requisito atual da Play: novos apps precisam ter target **API 36**, e este projeto já está assim.

---

## 5. Atualizar o jogo depois
1. Edite os arquivos em `www/` (o jogo) e rode `npm test` se mexer em fases ou na simulação (o validador confere as 30 fases).
2. `npm run sync` copia o jogo para dentro do projeto Android.
3. Gere um novo APK ou AAB (seções 2 e 3) e aumente o `versionCode`.

**Não mude** `appId` nem `server.androidScheme` no `capacitor.config.ts` depois de publicar: o progresso dos jogadores fica salvo nessa origem e seria perdido.

---

## 6. Detalhes técnicos
- **Botão Voltar:** `www/js/native.js` usa o plugin `@capacitor/app`. A lógica fica em `FF.Game.back()`, a mesma usada pela tecla Esc no navegador.
- **Segundo plano:** ao sair do app, a partida pausa e o áudio para (`appStateChange`).
- **Áreas seguras:** o Capacitor 8 desenha de ponta a ponta (edge-to-edge). O `SystemBars` injeta `--safe-area-inset-*`, que o CSS do jogo usa, com `env()` como reserva no navegador.
- **Salvamento:** `localStorage` na origem `https://localhost` do app. Ele persiste entre aberturas e entra no backup automático do Android (`allowBackup`).
- **Offline:** todos os arquivos estão no APK. A permissão `INTERNET` existe só porque o Capacitor a exige, e o jogo não faz requisições externas.
- **Tablets com Android 16:** o sistema pode ignorar a trava de retrato em telas grandes. O layout do jogo se adapta, mostrando uma coluna centralizada.
- **Ícones e splash:** são gerados por `node tools/android-assets.js` a partir do emblema do jogo.
