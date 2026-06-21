class_name PassiveData
extends Resource
## A passive item: a stat axis + per-level magnitude (06 §3, 08 §8).

@export var id: StringName = &""
@export var display_name: String = ""
@export var description: String = ""
@export var axis: StringName = &"might"     # matches PlayerStats.apply_passive
@export var magnitude: float = 0.1          # applied per level
@export var max_level: int = 5
@export var icon: Texture2D
