class_name HitboxComponent
extends Area2D
## Active dealer for CONTACT damage, e.g. enemy bodies (08 §3, 07 §6).
## Projectiles handle their own hits. Re-ticks the same target on an interval.

@export var damage: float = 10.0
@export var damage_interval: float = 0.5
@export var knockback_force: float = 0.0
## true = player attack (hits ENEMY_HURTBOX), false = enemy attack (hits PLAYER_HURTBOX).
@export var is_player_attack: bool = false

var _cooldowns: Dictionary = {}            # HurtboxComponent -> time_left

func _ready() -> void:
	if is_player_attack:
		collision_layer = CollisionLayers.PLAYER_ATTACK
		collision_mask = CollisionLayers.ENEMY_HURTBOX
	else:
		collision_layer = CollisionLayers.ENEMY_ATTACK
		collision_mask = CollisionLayers.PLAYER_HURTBOX
	monitoring = true
	monitorable = false
	area_entered.connect(_on_area_entered)

func _physics_process(delta: float) -> void:
	for hurtbox in _cooldowns.keys():
		if not is_instance_valid(hurtbox):
			_cooldowns.erase(hurtbox)
			continue
		_cooldowns[hurtbox] -= delta
		if _cooldowns[hurtbox] <= 0.0:
			if overlaps_area(hurtbox):
				_hit(hurtbox)
			else:
				_cooldowns.erase(hurtbox)

func _on_area_entered(area: Area2D) -> void:
	if area is HurtboxComponent and not _cooldowns.has(area):
		_hit(area)

func _hit(hurtbox: HurtboxComponent) -> void:
	# knockback_force is the dealt multiplier (scalar); enemies reverse-speed on it.
	hurtbox.receive(DamageInfo.new(damage, owner, false, knockback_force))
	_cooldowns[hurtbox] = damage_interval
