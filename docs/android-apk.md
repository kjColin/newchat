# Android APK

This project packages the existing React/Vite frontend as an Android WebView app with Capacitor.

## App Identity

- App name: `NewChat`
- Android package id: `com.kjcolin.newchat`
- Web assets directory: `src/frontend/dist`
- Production API base URL: `https://newchat.clnkj.de/api`
- Production Socket URL: `https://newchat.clnkj.de`

## First Build

Install dependencies and generate/sync the Android project from the frontend workspace:

```bash
cd /root/.openclaw/workspace/chat-app/src/frontend
npm install
npm run build:android
```

The `build:android` script builds the Vite app with Android-safe absolute API and Socket URLs, then runs `cap sync android`.

## Debug APK

Build a debug APK with Gradle:

```bash
cd /root/.openclaw/workspace/chat-app/src/frontend/android
./gradlew assembleDebug
```

Expected output:

```text
src/frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

The current server workspace can run `npm run build:android` and sync the Android project, but `./gradlew assembleDebug` requires a usable Android SDK/Gradle environment. If Gradle exits before configuration with `Could not determine a usable wildcard IP for this machine`, build the APK from Android Studio or a CI runner with a normal Android SDK installation.

## GitHub Actions

The repository includes `.github/workflows/android-apk.yml` for CI-built debug APKs.

It runs on:

- manual `workflow_dispatch`
- pushes to `feature/android-capacitor-apk` that change the frontend, APK docs, or the workflow

The workflow:

1. installs frontend dependencies with `npm ci`
2. runs `npm test`
3. runs `npm run build:android`
4. runs `./gradlew assembleDebug`
5. uploads `newchat-debug-apk`

Download the APK from the workflow run artifacts:

```text
newchat-debug-apk/app-debug.apk
```

The latest verified run at the time of this update is:

- Run: `https://github.com/kjColin/newchat/actions/runs/27466092918`
- Artifact: `newchat-debug-apk`

## Android Studio

Open the generated Android project when interactive debugging is needed:

```bash
cd /root/.openclaw/workspace/chat-app/src/frontend
npm run android:open
```

## Runtime Notes

- Browser builds continue to use relative `/api` and `/socket.io` paths through the Vite/Nginx proxy.
- Android builds must use `VITE_API_BASE_URL` and `VITE_SOCKET_URL` because packaged WebView assets are served from the app origin, not `newchat.clnkj.de`.
- Capacitor Android serves bundled web assets from `https://localhost`. The production backend `CORS_ORIGINS` must include `https://localhost`; otherwise the APK login request is blocked by WebView CORS and the UI only shows `An error occurred`.
- The first APK keeps foreground Socket and in-app notification behavior. Native Android push should be added in a later FCM + Capacitor Push Notifications pass.
- File upload should be validated on a physical Android device because WebView file picker behavior differs from desktop browsers.

Validate APK CORS against production:

```bash
curl -i -X OPTIONS https://newchat.clnkj.de/api/auth/login \
  -H 'Origin: https://localhost' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type'
```

Expected: `204 No Content` with `access-control-allow-origin: https://localhost`.

## Release Signing

The generated debug APK is not suitable for store distribution. For release builds, create a dedicated signing key and configure Gradle signing outside the repository. Do not commit keystore files or passwords.
