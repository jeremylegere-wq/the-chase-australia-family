#!/usr/bin/env bash
set -euo pipefail
GAME_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="${XDG_DESKTOP_DIR:-$HOME/Desktop}"
if [ ! -d "$DESKTOP_DIR" ]; then
  DESKTOP_DIR="$HOME"
fi
mkdir -p "$DESKTOP_DIR"
SHORTCUT="$DESKTOP_DIR/the-chase-australia-family.desktop"
LAUNCHER="$GAME_DIR/launch-game-linux.sh"
python3 - "$SHORTCUT" "$LAUNCHER" <<'PY'
import os, sys
shortcut, launcher = sys.argv[1], sys.argv[2]
def esc(value):
    return value.replace("\\\\", "\\\\\\\\").replace('"', '\\\\"').replace("`", "\\\\`").replace("$", "\\\\$")
# Desktop Entry Exec quoting: double-quote absolute path; escape spaces and reserved chars.
exec_path = launcher.replace("\\\\", "\\\\\\\\").replace('"', '\\\\"').replace(" ", "\\\\ ").replace("$", "\\\\$")
content = f"""[Desktop Entry]
Version=1.0
Type=Application
Name=The Chase Australia - Family Edition
Comment=Launch the offline family quiz game
Exec={exec_path}
Path={os.path.dirname(launcher)}
Terminal=false
Categories=Game;
"""
with open(shortcut, "w", encoding="utf-8") as f:
    f.write(content)
os.chmod(shortcut, 0o755)
print("Desktop shortcut created:", shortcut)
PY
# Some desktop environments require an explicit trust/allow-launch action on first use.
echo "If prompted, choose 'Allow Launching' or 'Trust and Launch'."
