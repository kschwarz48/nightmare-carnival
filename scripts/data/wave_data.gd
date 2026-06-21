class_name WaveData
extends Resource
## A time-windowed spawn table (08 §13, 03 §7.4). The director gathers all
## active waves at the current time and weighted-samples one enemy.

@export var id: StringName = &""
@export var start_time: float = 0.0      # seconds
@export var end_time: float = 9999.0
@export var enemies: Array[EnemyData] = []
@export var weights: Array[float] = []

func is_active(seconds: float) -> bool:
	return seconds >= start_time and seconds < end_time

## Returns [[EnemyData, weight], ...].
func weighted_enemies() -> Array:
	var out: Array = []
	for i in enemies.size():
		var w: float = weights[i] if i < weights.size() else 1.0
		out.append([enemies[i], w])
	return out
