#!/bin/sh
# The arsenal bench in parallel groups (D-103). usage: run-arsenal.sh <label> <web dir> [--pairs]
# Writes artifacts/balance/<label>_*.json at the repo root; <web dir> may be a worktree of older code (with its
# node_modules junctioned in) for a baseline.
L=$1; WEB=$2; MODE=$3
OUT="$(cd "$(dirname "$0")/../../.." && pwd)/artifacts/balance"; mkdir -p "$OUT"
cd "$WEB"
if [ "$MODE" = "--pairs" ]; then
  P1="tarot+orbs;throwing_cards+orbs;tarot+mallet;throwing_cards+snowcone"
  P2="throwing_cards+grill;tarot+bell;steam_whistle+tarot;throwing_cards+cotton"
  P3="tarot+lantern;tarot+throwing_cards;mallet+orbs;grill+snowcone"
  P4="steam_whistle+orbs;lantern+orbs;tarot+steam_calliope;throwing_cards+chains"
  i=0
  for P in "$P1" "$P2" "$P3" "$P4"; do
    i=$((i+1))
    npx vite-node scripts/bench/arsenal.ts "$OUT/pairs-${L}_$i.json" --pairs --pairlist="$P" --levels=L8,E8 --fights=boss,swarm,mixed,night --seeds=2 > "$OUT/pairs-${L}_$i.log" 2>&1 &
  done
else
  i=0
  for G in throwing_cards,mallet,tarot,bumper plush,tophat,popcorn,darts fireworks,cotton,rings,cannon snowcone,grill,laser,lantern chains,breath,orbs,bell mirror,steam_whistle,steam_calliope; do
    i=$((i+1))
    npx vite-node scripts/bench/arsenal.ts "$OUT/${L}_$i.json" --only=$G --seeds=2 > "$OUT/${L}_$i.log" 2>&1 &
  done
fi
wait
echo done
