class_name Weapon
extends Node2D
## Base auto-firing weapon (08 §8.1). Subclasses override fire().
## Reads live player stats so passives/level-ups flow through uniformly.

@export var data: WeaponData
var level: int = 1
var _cd: float = 0.0

func setup(p_data: WeaponData) -> void:
	data = p_data
	_cd = current_cooldown()

func _process(delta: float) -> void:
	if GameState.is_paused or not GameState.is_running:
		return
	if GameState.player == null:
		return
	_cd -= delta
	if _cd <= 0.0:
		fire()
		_cd = current_cooldown()

# --- helpers reading the live player stats ---
func _stats() -> PlayerStats:
	return (GameState.player as Player).stats

func current_cooldown() -> float: return data.cooldown_at(level) * _stats().cooldown_mult
func current_damage() -> float:   return data.damage_at(level) * _stats().might_mult
func current_amount() -> int:     return data.amount_at(level) + _stats().amount_add
func current_area() -> float:     return data.area_at(level) * _stats().area_mult

func level_up() -> void:
	level = mini(level + 1, data.max_level)

func fire() -> void:
	push_error("Weapon.fire() must be overridden")
