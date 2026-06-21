class_name EvolutionSystem
extends RefCounted
## Detects ready weapon evolutions for the draft (06 §5, 08 §9.2). A weapon is
## evolution-ready when it is maxed AND its required passive is owned (>= 1).

## Returns a runtime EVOLUTION UpgradeData for the first ready weapon, or null.
static func find_ready_evolution(player: Player) -> UpgradeData:
	var wm := player.weapon_manager
	for id: StringName in wm.weapons:
		var w: Weapon = wm.weapons[id]
		var wd: WeaponData = w.data
		if wd.evolution == null:
			continue
		if w.level < wd.max_level:
			continue
		if wd.required_passive != &"" and int(player.passive_levels.get(wd.required_passive, 0)) < 1:
			continue
		var evo := wd.evolution as EvolutionData
		if evo == null or evo.result == null:
			continue
		return UpgradeData.make_evolution(wd, evo)
	return null
