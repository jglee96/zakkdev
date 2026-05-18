#!/usr/bin/env bash
# Render mermaid sources under content/<slug>-assets/*.mmd
# to public/content/<slug>-assets/<name>-{light,dark}.svg
# Usage: pnpm diagrams
set -euo pipefail

shopt -s nullglob

found=0
for src_dir in content/*-assets; do
  [ -d "$src_dir" ] || continue
  mmd_files=("$src_dir"/*.mmd)
  [ ${#mmd_files[@]} -gt 0 ] || continue

  slug_dir="$(basename "$src_dir")"
  out_dir="public/content/$slug_dir"
  mkdir -p "$out_dir"

  for mmd in "${mmd_files[@]}"; do
    name="$(basename "$mmd" .mmd)"
    light_out="$out_dir/$name-light.svg"
    dark_out="$out_dir/$name-dark.svg"
    echo "rendering $mmd"
    echo "  -> $light_out"
    pnpm exec mmdc -i "$mmd" -o "$light_out" -t default -b transparent
    echo "  -> $dark_out"
    pnpm exec mmdc -i "$mmd" -o "$dark_out" -t dark -b transparent
    found=1
  done
done

if [ "$found" = "0" ]; then
  echo "no .mmd sources found under content/*-assets/"
fi

echo "done."
