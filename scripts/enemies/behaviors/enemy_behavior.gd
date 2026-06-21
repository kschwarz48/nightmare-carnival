class_name EnemyBehavior
extends RefCounted
## Lightweight AI module (08 §11). One file per behavior; a factory maps the
## EnemyData.behavior key to a script. Behaviors are RefCounted (no node overhead).

# Registry grows as behaviors are added in later milestones (doc 04 names).
const REGISTRY := {
	&"chaser": preload("res://scripts/enemies/behaviors/chaser_behavior.gd"),
}

static func create(key: StringName) -> EnemyBehavior:
	var script: GDScript = REGISTRY.get(key, REGISTRY[&"chaser"])
	return script.new()

func setup(_enemy: Enemy) -> void:
	pass

func physics_update(_enemy: Enemy, _delta: float) -> void:
	pass

## Shared helper: unit vector toward the player.
func to_player(enemy: Enemy) -> Vector2:
	return enemy.global_position.direction_to(GameState.player.global_position)
