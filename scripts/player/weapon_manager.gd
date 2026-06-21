class_name WeaponManager
extends Node
## Holds active Weapon child nodes; one slot per weapon (08 §8.1, 06 §1).

const MAX_WEAPONS := 6

# map style -> weapon script (extend as styles are added)
const WEAPON_SCRIPTS := {
	&"projectile": preload("res://scripts/weapons/projectile_weapon.gd"),
}

var weapons: Dictionary = {}   # weapon_id -> Weapon

func has_room() -> bool:
	return weapons.size() < MAX_WEAPONS

func has_weapon(id: StringName) -> bool:
	return weapons.has(id)

func is_weapon_maxed(id: StringName) -> bool:
	if not weapons.has(id):
		return false
	var w: Weapon = weapons[id]
	return w.level >= w.data.max_level

func add_weapon(wdata: WeaponData) -> void:
	if weapons.has(wdata.id):
		(weapons[wdata.id] as Weapon).level_up()
		return
	if not has_room():
		return
	var script: GDScript = WEAPON_SCRIPTS.get(wdata.style, WEAPON_SCRIPTS[&"projectile"])
	var w: Weapon = script.new()
	add_child(w)
	w.setup(wdata)
	weapons[wdata.id] = w

func level_up_weapon(id: StringName) -> void:
	if weapons.has(id):
		(weapons[id] as Weapon).level_up()
