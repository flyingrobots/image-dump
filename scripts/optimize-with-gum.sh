#!/usr/bin/env bash
set -euo pipefail

ARGS=("$@")

if [[ -n "${OPTIMIZE_NO_GUM:-}" ]]; then
  USE_GUM=false
elif ! command -v gum >/dev/null 2>&1; then
  echo "gum not found on PATH – falling back to processing all images." >&2
  USE_GUM=false
elif [[ ! -t 0 || ! -t 1 ]]; then
  USE_GUM=false
else
  USE_GUM=true
fi

if [[ " ${ARGS[*]} " == *" --watch "* ]]; then
  USE_GUM=false
fi

mapfile -d '' -t IMAGE_PATHS < <(find original -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.gif' -o -iname '*.webp' \) -print0 | sort -z)

if (( ${#IMAGE_PATHS[@]} == 0 )); then
  echo "No images found in original/." >&2
  exit 0
fi

SELECTION_MODE="all"
SELECTION_PAYLOAD=""

if [[ "$USE_GUM" == true ]]; then
  gum style --foreground="212" --bold --margin="0 0 1 0" "🧪 Image Cookery"

  if gum confirm --default=false "Cook all ${#IMAGE_PATHS[@]} images?"; then
    SELECTION_MODE="all"
  else
    mapfile -t DISPLAY_LIST < <(printf '%s\n' "${IMAGE_PATHS[@]}" | sed -e 's#^\./##' -e 's#^original/##')
    if (( ${#DISPLAY_LIST[@]} == 0 )); then
      echo "No selectable images detected." >&2
      exit 0
    fi

    SELECTED=$(printf '%s\n' "${DISPLAY_LIST[@]}" | gum choose --no-limit --header "Select images to cook" --cursor "👉" || true)

    if [[ -z "${SELECTED:-}" ]]; then
      echo "No images selected. Exiting." >&2
      exit 0
    fi

    SELECTION_MODE="selection"
    SELECTION_PAYLOAD=$(printf '%s\n' "$SELECTED" | base64 | tr -d '\n')
  fi
fi

ENV_ARGS=()
if [[ "$SELECTION_MODE" == "selection" ]]; then
  ENV_ARGS+=("-e" "OPTIMIZE_SELECTION_B64=${SELECTION_PAYLOAD}")
fi

exec docker compose run --rm "${ENV_ARGS[@]}" optimize "${ARGS[@]}"
