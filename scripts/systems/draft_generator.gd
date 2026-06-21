class_name DraftGenerator
extends RefCounted
## Builds N legal, weighted, distinct upgrade options for the level-up draft
## (08 §9.2, 06 §4). Evolution guarantee lands with EvolutionSystem at M2.

static func generate(count: int) -> Array[UpgradeData]:
	var player := GameState.player as Player
	var pool: Array = []                    # [{ "data": UpgradeData, "weight": float }]
	for up: UpgradeData in ContentDB.all_upgrades():
		if not up.is_legal(player):
			continue
		var w := up.base_weight * up.rarity_weight(player.stats.luck) * up.relevance_bonus(player)
		pool.append({ "data": up, "weight": w })
	return _weighted_sample(pool, count)

static func _weighted_sample(pool: Array, n: int) -> Array[UpgradeData]:
	var result: Array[UpgradeData] = []
	var working := pool.duplicate()
	for _i in n:
		if working.is_empty():
			break
		var total := 0.0
		for item in working:
			total += item.weight
		var r := randf() * total
		var acc := 0.0
		for j in working.size():
			acc += working[j].weight
			if r <= acc:
				result.append(working[j].data)
				working.remove_at(j)
				break
	return result
