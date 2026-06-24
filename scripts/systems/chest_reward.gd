class_name ChestReward
extends RefCounted
## VS-style chest payout (03 §6): grant N upgrades to RANDOM already-equipped
## items (no choice). Each roll levels an owned weapon or a held passive that
## isn't maxed; if everything is maxed, it falls back to a new weapon (if there's
## a slot). Reuses UpgradeData.is_legal/apply so caps + unlock gates are honored.

static func grant(player: Player, rolls: int) -> void:
	for _i in maxi(1, rolls):
		var pool := _upgradeable(player)
		if pool.is_empty():
			var nw := _new_weapon(player)
			if nw != null:
				nw.apply(player)
				EventBus.upgrade_chosen.emit(nw)
			continue
		var up: UpgradeData = pool.pick_random()
		up.apply(player)
		EventBus.upgrade_chosen.emit(up)

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
