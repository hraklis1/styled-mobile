# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# iOS Simulator

Launch the app with:

```sh
npm run ios
```

This builds the native app, boots the iOS simulator, installs the app, and connects
to Metro. Its `preios` script also verifies the configured local API and starts
the sibling `../Styled` backend when needed. If Expo says it is skipping the dev
server, verify the existing Metro server at `http://localhost:8081`; start it
with `npm start` only if it is not already running.

The generated `ios/` directory is gitignored. If CocoaPods reports stale local
Expo podspecs after dependencies change, run:

```sh
cd ios
pod update --no-repo-update
cd ..
npm run ios
```

For the current generated native project, SDK 56 no longer provides
`ExpoModulesCore/EXEventEmitterService.h`. If that import appears in
`ios/Styled/Styled-Bridging-Header.h`, remove only that obsolete import before
rebuilding.
