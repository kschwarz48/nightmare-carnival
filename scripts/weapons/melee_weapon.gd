extends Weapon
## Whack-a-Mole Mallet (06 §2, 08 §8 "Other weapon styles"). Around-self: each
## cooldown it slams a brief AoE swing centered on the player (a melee_arc, which
## reuses the pooled Explosion damage logic). A defensive shape of fire — no
## projectile, no aim; it punishes anything that closes on you.

func fire() -> void:
	if data.projectile_scene == null or GameState.player == null:
		return
	var swing := ObjectPool.acquire(data.projectile_scene, _world_layer()) as Explosion
	swing.global_position = GameState.player.global_position
	swing.detonate(current_damage(), current_area(), _stats().roll_crit(), _stats().crit_damage)

func _world_layer() -> Node:
	return GameState.projectile_layer
