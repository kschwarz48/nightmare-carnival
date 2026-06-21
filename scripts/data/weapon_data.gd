class_name WeaponData
extends Resource
## Data-driven weapon definition (08 §8, 06_weapons_and_upgrades.md §7).
## Per-level deltas are summed cumulatively up to the current level.

@export var id: StringName = &""
@export var display_name: String = ""
@export var description: String = ""
@export var style: StringName = &"projectile"      # selects the Weapon script
@export var aim_mode: StringName = &"auto_nearest"  # auto_nearest/auto_random/forward/manual
@export var projectile_scene: PackedScene
@export var icon: Texture2D
@export var max_level: int = 8

# base stats
@export var base_damage: float = 10.0
@export var base_cooldown: float = 1.0
@export var base_area: float = 1.0
@export var base_amount: int = 1
@export var base_projectile_speed: float = 400.0
@export var base_pierce: int = 0
@export var lifetime: float = 2.0

# per-level deltas (index 0 unused; summed cumulatively)
@export var level_damage: Array[float] = []
@export var level_cooldown: Array[float] = []
@export var level_area: Array[float] = []
@export var level_amount: Array[int] = []

# evolution linkage (06 §5)
@export var evolution: Resource           # EvolutionData
@export var required_passive: StringName = &""

func _sum_f(arr: Array, lvl: int) -> float:
	var t := 0.0
	for i in mini(lvl, arr.size()):
		t += arr[i]
	return t

func damage_at(lvl: int) -> float:    return base_damage + _sum_f(level_damage, lvl)
func cooldown_at(lvl: int) -> float:  return maxf(0.1, base_cooldown + _sum_f(level_cooldown, lvl))
func area_at(lvl: int) -> float:      return base_area + _sum_f(level_area, lvl)
func amount_at(lvl: int) -> int:      return base_amount + int(_sum_f(level_amount, lvl))
func projectile_speed_at(_lvl: int) -> float: return base_projectile_speed
func pierce_at(_lvl: int) -> int:     return base_pierce
