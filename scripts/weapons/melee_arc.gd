extends Explosion
## Mallet swing (06 §2). Reuses Explosion's AoE damage, but tracks the player for
## its short life so the swing stays centered as you move — an "around-self" hit.

func _process(delta: float) -> void:
	if is_instance_valid(GameState.player):
		global_position = GameState.player.global_position
	super._process(delta)
