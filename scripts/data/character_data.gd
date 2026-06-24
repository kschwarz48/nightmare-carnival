class_name CharacterData
extends Resource
## A playable character (01 §6). Base stats + signature weapon + identity.
## make_stats() produces a fresh per-run PlayerStats copy.

@export var id: StringName = &""
@export var display_name: String = ""
@export var description: String = ""

@export var base_max_health: float = 100.0
@export var base_move_speed: float = 110.0
@export var base_pickup_radius: float = 60.0
@export var might_mult: float = 1.0
@export var xp_gain_mult: float = 1.0
@export var knockback: float = 0.0             # Strongman quirk: shove enemies that hit you

# programmer-art visual
@export var color: Color = Color(0.2, 0.8, 1.0)
@export var radius: float = 12.0

@export var starting_weapon: WeaponData
@export var unlock_id: StringName = &""        # "" = available by default

func make_stats() -> PlayerStats:
	var s := PlayerStats.new()
	s.base_max_health = base_max_health
	s.base_move_speed = base_move_speed
	s.base_pickup_radius = base_pickup_radius
	s.might_mult = might_mult
	s.xp_gain_mult = xp_gain_mult
	s.knockback = knockback
	return s
