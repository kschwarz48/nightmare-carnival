extends Node2D
## A cuttable string holding up the Puppet King (05 BOSS 3 P2). A sub-target with
## its own small HP and an ENEMY_HURTBOX so player attacks damage it. Emits `cut`
## when destroyed; the King staggers once all its strings are cut.

signal cut

const STRING_HP := 500.0

@onready var health: HealthComponent = $HealthComponent
@onready var hurtbox: HurtboxComponent = $HurtboxComponent
@onready var visual: Blob = $Visual

func _ready() -> void:
	hurtbox.health_component = health
	health.set_max_health(STRING_HP)
	health.died.connect(_on_died)

func _on_died(_info: DamageInfo) -> void:
	cut.emit()
	queue_free()
