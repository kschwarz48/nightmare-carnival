class_name PlayerStats
extends Resource
## All player combat stats in one resource (08 §6). Passives/level-ups/meta
## modify the accumulators; the computed funcs produce values weapons read.

# --- base values (from CharacterData) ---
@export var base_max_health: float = 100.0
@export var base_move_speed: float = 220.0
@export var base_pickup_radius: float = 60.0

# --- accumulators (modified by passives/upgrades/meta) ---
var might_mult: float = 1.0
var cooldown_mult: float = 1.0          # < 1.0 = faster
var area_mult: float = 1.0
var duration_mult: float = 1.0
var projectile_speed_mult: float = 1.0
var amount_add: int = 0
var crit_chance: float = 0.05
var crit_damage: float = 2.0
var armor: float = 0.0
var luck: float = 1.0
var greed: float = 1.0
var xp_gain_mult: float = 1.0
var hp_regen: float = 0.0
var revives: int = 0
var knockback: float = 0.0          # impulse applied to enemies that hit you (Strongman quirk)

var max_health_add: float = 0.0
var max_health_mult: float = 1.0
var move_speed_mult: float = 1.0
var pickup_radius_mult: float = 1.0

# --- computed (read by gameplay) ---
func max_health() -> float: return (base_max_health + max_health_add) * max_health_mult
func move_speed() -> float: return base_move_speed * move_speed_mult
func pickup_radius() -> float: return base_pickup_radius * pickup_radius_mult

func roll_crit() -> bool:
	return randf() < crit_chance * (0.5 + 0.5 * luck)

## Apply a passive's per-level effect. Called by the level/upgrade system.
func apply_passive(axis: StringName, magnitude: float) -> void:
	match axis:
		&"might": might_mult += magnitude
		&"cooldown": cooldown_mult = maxf(0.25, cooldown_mult - magnitude)
		&"area": area_mult += magnitude
		&"duration": duration_mult += magnitude
		&"projectile_speed": projectile_speed_mult += magnitude
		&"amount": amount_add += int(magnitude)
		&"crit_chance": crit_chance += magnitude
		&"crit_damage": crit_damage += magnitude
		&"armor": armor += magnitude
		&"luck": luck += magnitude
		&"greed": greed += magnitude
		&"xp": xp_gain_mult += magnitude
		&"regen": hp_regen += magnitude
		&"max_health": max_health_mult += magnitude
		&"move_speed": move_speed_mult += magnitude
		&"pickup": pickup_radius_mult += magnitude
		&"revive": revives += int(magnitude)
		&"knockback": knockback += magnitude
		_: push_warning("Unknown stat axis: %s" % axis)
