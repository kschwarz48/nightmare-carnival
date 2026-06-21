class_name HurtboxComponent
extends Area2D
## Passive damage receiver wrapping a HealthComponent (08 §3, 07 §6).
## Scanned BY hitboxes/projectiles; it does not scan (mask = 0).

@export var health_component: HealthComponent
## true = player's hurtbox (PLAYER_HURTBOX), false = enemy's (ENEMY_HURTBOX).
@export var is_player_hurtbox: bool = false

func _ready() -> void:
	collision_layer = CollisionLayers.PLAYER_HURTBOX if is_player_hurtbox else CollisionLayers.ENEMY_HURTBOX
	collision_mask = 0
	monitoring = false        # hurtboxes are scanned, they don't scan
	monitorable = true

func receive(info: DamageInfo) -> void:
	if health_component:
		health_component.take_damage(info)
