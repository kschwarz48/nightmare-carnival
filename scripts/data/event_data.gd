class_name EventData
extends Resource
## A carnival event (03 §5, 07 §8). Authored as a .tres and triggered by a
## WaveData.event key (or directly via EventRunner). `type` selects the handler;
## `params` carries the type-specific knobs. Instant spawn-events ship now; timed
## hazard events (a duration) get a runner host node in M5.

@export var id: StringName = &""
@export var display_name: String = ""
@export var type: StringName = &"elite_pack"   # elite_pack | miniboss | stampede
@export var banner: String = ""                # optional HUD announce text
@export var params: Dictionary = {}            # e.g. { "enemy_id": &"evil_clown", "count": 5 }
