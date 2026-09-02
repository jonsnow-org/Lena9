# Archived: Flutter WebView wrapper app

This folder holds the previous "native" Android app — a Flutter WebView
wrapper around the live website (`flutter_app/`), plus the three CI
workflows that built/diagnosed it (`.github-workflows/*.yml.disabled`).

It has been **retired and disabled**, not deleted, on 2026-09-02: the real
native rewrite now lives under `android-native/` (Kotlin + Jetpack Compose),
built by `.github/workflows/build-kotlin-apk.yml`. Both pipelines used to
write to the same site download button (`public/downloads/Literium.apk`),
which meant the button randomly flip-flopped between two completely
different apps depending on which workflow ran last — this archive stops
that by removing the Flutter workflows from `.github/workflows/` entirely
(GitHub Actions only picks up workflows from that exact path, so moving
them here disables them without deleting the history or source).

To ever resurrect this app: move `.github-workflows/*.yml.disabled` back
into `.github/workflows/` (dropping the `.disabled` suffix) and move
`flutter_app/` back to the repo root.

See `flutter_app/README.md` for why this WebView wrapper existed in the
first place (it replaced an even earlier, incomplete full-native attempt).
