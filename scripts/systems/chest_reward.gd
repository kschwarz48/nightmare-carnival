class_name ChestReward
extends RefCounted
## VS-style chest payout (03 §6): grant N upgrades to RANDOM already-equipped
## items (no choice). Each roll levels an owned weapon or a held passive that
## isn't maxed; if everything is maxed, it falls back to a new weapon (if there's
## a slot). Reuses UpgradeData.is_legal/apply so caps + unlock gates are honored.

static func grant(player: Player, rolls: int) -> void:
	var granted: Array[String] = []
	for _i in maxi(1, rolls):
		var pool := _upgradeable(player)
		var up: UpgradeData = null
		if pool.is_empty():
			up = _new_weapon(player)
		else:
			up = pool.pick_random()
		if up == null:
			continue
		up.apply(player)
		EventBus.upgrade_chosen.emit(up)
		granted.append(_label(player, up))
	# Drives the chest-open toast (HUD) so the reward is legible — the grant is
	# otherwise silent (03 §6).
	EventBus.chest_opened.emit(granted)

## A short readable line for the toast, e.g. "Throwing Cards Lv 4" / "+Might".
static func _label(player: Player, up: UpgradeData) -> String:
	match up.kind:
		UpgradeData.Kind.LEVEL_WEAPON:
			var w = player.weapon_manager.weapons.get(up.weapon.id)
			return "%s Lv %d" % [up.weapon.display_name, w.level if w else 1]
		UpgradeData.Kind.NEW_WEAPON:
			return "New: %s" % up.weapon.display_name
		UpgradeData.Kind.PASSIVE:
			return "+%s" % up.passive.display_name
	return up.display_name

static func _upgradeable(player: Player) -> Array:
	var out: Array = []
	for up: UpgradeData in ContentDB.all_upgrades():
		if not up.is_legal(player):
			continue
		# LEVEL_WEAPON is_legal already requires the weapon be owned; for passives
		# restrict to ones the player ACTUALLY HOLDS (not new ones) — "already
		# equipped items" (03 §6).
		if up.kind == UpgradeData.Kind.LEVEL_WEAPON:
			out.append(up)
		elif up.kind == UpgradeData.Kind.PASSIVE and int(player.passive_stacks.get(up.id, 0)) > 0:
			out.append(up)
	return out

static func _new_weapon(player: Player) -> UpgradeData:
	for up: UpgradeData in ContentDB.all_upgrades():
		if up.kind == UpgradeData.Kind.NEW_WEAPON and up.is_legal(player):
			return up
	return null
