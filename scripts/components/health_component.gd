class_name HealthComponent
extends Node
## One component owns an actor's HP (08 §2). Players, enemies, bosses use it.

signal health_changed(current: float, maximum: float)
signal damaged(info: DamageInfo)          # before death; drives flash + numbers
signal died(info: DamageInfo)
signal healed(amount: float)

@export var max_health: float = 10.0
@export var armor: float = 0.0            # flat reduction per hit, min 1 dmg
@export var invincible: bool = false

var current_health: float

func _ready() -> void:
	current_health = max_health

func take_damage(info: DamageInfo) -> void:
	if invincible or current_health <= 0.0:
		return
	var dealt: float = maxf(1.0, info.amount - armor)
	current_health -= dealt
	# Re-pack the real dealt amount so listeners (damage numbers) show it.
	info.amount = dealt
	damaged.emit(info)
	health_changed.emit(current_health, max_health)
	if current_health <= 0.0:
		died.emit(info)

func heal(amount: float) -> void:
	if current_health <= 0.0:
		return
	current_health = minf(current_health + amount, max_health)
	healed.emit(amount)
	health_changed.emit(current_health, max_health)

func set_max_health(value: float, keep_ratio: bool = false) -> void:
	var ratio := current_health / max_health if max_health > 0.0 else 1.0
	max_health = value
	current_health = max_health * ratio if keep_ratio else max_health
	health_changed.emit(current_health, max_health)

func revive_to(ratio: float) -> void:
	current_health = max_health * clampf(ratio, 0.01, 1.0)
	health_changed.emit(current_health, max_health)

func get_ratio() -> float:
	return current_health / max_health if max_health > 0.0 else 0.0
