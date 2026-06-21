class_name DifficultyData
extends Resource
## Tier multipliers read by the EnemyDirector (08 §13, 01 §10, 03 §7).

@export var id: StringName = &""
@export var display_name: String = ""
@export var base_spawn_rate: float = 3.0    # spawns per second at 0:00
@export var hp_mult: float = 1.0
@export var dmg_mult: float = 1.0
@export var max_alive: int = 300
@export var greed_bonus: float = 0.0
