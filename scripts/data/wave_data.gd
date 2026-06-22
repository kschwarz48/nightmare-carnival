class_name WaveData
extends Resource
## One entry on a stage's wave timeline (VS-style; 03 §7.4, 08 §13). The director
## runs the latest-started active wave and spawns by these rules:
##   1. Keep at least `min_alive` enemies on the field — if the count drops below
##      it (you cleared a crowd), top up immediately to the minimum.
##   2. On top of that, add `spawn_batch` enemies every `spawn_interval` seconds,
##      up to `max_alive`.
## Scaling across a run is authored as the timeline itself: later waves raise
## min/max, shorten the interval, and shift the enemy mix toward tougher types.

@export var id: StringName = &""
@export var start_time: float = 0.0          # seconds; wave activates at this time
@export var end_time: float = 99999.0        # ...and deactivates here (usually open-ended)
@export var enemies: Array[EnemyData] = []
@export var weights: Array[float] = []

## Baseline crowd. Below this, the director instantly tops up to the minimum.
@export var min_alive: int = 8
## Per-wave ceiling (also clamped by the difficulty's global max_alive for perf).
@export var max_alive: int = 60
## Seconds between regular spawn batches (added on top of the min top-up).
@export var spawn_interval: float = 1.0
## Enemies added per regular batch.
@export var spawn_batch: int = 1

# --- overlay mechanics ---
## Periodic flyby swarm (a cross-screen "dodge this"). Null swarm_enemy or
## swarm_interval <= 0 disables it.
@export var swarm_enemy: EnemyData = null
@export var swarm_interval: float = 0.0
@export var swarm_size: int = 10
## Elites spawned once when this wave first becomes active (the gauntlet beat).
@export var elite_burst: int = 0

# --- forward hooks (authored now; logic lands in later milestones) ---
@export var boss: Resource = null            # BossData to spawn on this wave (M3)
@export var event: StringName = &""          # special-event key (M5)

func is_active(seconds: float) -> bool:
	return seconds >= start_time and seconds < end_time

## Returns [[EnemyData, weight], ...].
func weighted_enemies() -> Array:
	var out: Array = []
	for i in enemies.size():
		var w: float = weights[i] if i < weights.size() else 1.0
		out.append([enemies[i], w])
	return out
