#!/bin/zsh
# Installe ou met à jour Parrot.
#  - copie le programme dans ~/Library/Application Support/Transcription Teams/
#  - construit « Parrot Widget » (la fenêtre de fin, sans autorisation particulière)
#  - construit /Applications/Parrot.app seulement s'il n'existe pas encore : le reconstruire
#    changerait sa signature et macOS retirerait l'autorisation Accessibilité.
#    Pour le reconstruire quand même : zsh install.sh --rebuild-app
set -euo pipefail

SRC="${0:A:h}/src"
ASSETS="${0:A:h}/assets"
DATA="$HOME/Library/Application Support/Transcription Teams"
APP="/Applications/Parrot.app"
WIDGET="$DATA/Parrot Widget.app"
LSREGISTER=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

for f in lanceur.js transcription-teams-app.js widget.js widget-app.js; do
  [[ -f "$SRC/$f" ]] || { echo "Fichier manquant : src/$f" >&2; exit 1; }
done

echo "→ Programme"
mkdir -p "$DATA"
cp "$SRC/transcription-teams-app.js" "$SRC/widget.js" "$DATA/"
cp "$ASSETS/logo-petit.png" "$DATA/logo.png"

echo "→ Parrot Widget"
pkill -f '[P]arrot Widget.app/Contents/MacOS' 2>/dev/null || true
cat "$SRC/widget.js" "$SRC/widget-app.js" > "$TMP/widget-app.js"
rm -rf "$WIDGET"
osacompile -s -l JavaScript -o "$WIDGET" "$TMP/widget-app.js"
/usr/libexec/PlistBuddy -c "Add :LSUIElement bool true" "$WIDGET/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Add :CFBundleIdentifier string app.parrot.widget" "$WIDGET/Contents/Info.plist"
codesign --force --deep -s - "$WIDGET" 2>/dev/null
"$LSREGISTER" -f "$WIDGET"

if [[ ! -d "$APP" || "${1:-}" == "--rebuild-app" ]]; then
  echo "→ Parrot.app"
  rm -rf "$APP"
  osacompile -l JavaScript -o "$APP" "$SRC/lanceur.js"
  /usr/libexec/PlistBuddy -c "Add :CFBundleIdentifier string app.parrot.teams" "$APP/Contents/Info.plist"
  /usr/libexec/PlistBuddy -c "Set :NSAppleEventsUsageDescription Lire la transcription affichée dans Microsoft Teams." "$APP/Contents/Info.plist" 2>/dev/null \
    || /usr/libexec/PlistBuddy -c "Add :NSAppleEventsUsageDescription string Lire la transcription affichée dans Microsoft Teams." "$APP/Contents/Info.plist"
  # Icône : un échec ici ne doit pas empêcher l'installation
  ICONSET="$TMP/Parrot.iconset"
  mkdir -p "$ICONSET"
  for size in 16 32 128 256 512; do
    sips -z $size $size "$ASSETS/logo.png" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null 2>&1 || true
    sips -z $((size * 2)) $((size * 2)) "$ASSETS/logo.png" --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null 2>&1 || true
  done
  iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/applet.icns" 2>/dev/null || echo "  (icône non appliquée, sans conséquence)"
  codesign --force --deep -s - "$APP" 2>/dev/null
  "$LSREGISTER" -f "$APP"
  echo
  echo "Parrot.app est installé. Dernière étape, une seule fois :"
  echo "  Réglages Système > Confidentialité et sécurité > Accessibilité : ajoute et active « Parrot »."
  echo "  Au premier lancement, accepte aussi que Parrot contrôle « System Events »."
else
  echo "→ Parrot.app déjà installé : conservé (l'autorisation Accessibilité reste valable)"
fi

echo
echo "Terminé."
