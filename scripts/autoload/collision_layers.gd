extends Node
## Named collision layer bits (07_godot_architecture.md §6).
## Set masks/layers via these constants, never raw numbers.

const WORLD          := 1 << 0   # bit 1
const PLAYER         := 1 << 1   # bit 2
const PLAYER_HURTBOX := 1 << 2   # bit 3
const ENEMY          := 1 << 3   # bit 4
const ENEMY_HURTBOX  := 1 << 4   # bit 5
const PLAYER_ATTACK  := 1 << 5   # bit 6
const ENEMY_ATTACK   := 1 << 6   # bit 7
const PICKUP         := 1 << 7   # bit 8
const PICKUP_MAGNET  := 1 << 8   # bit 9
