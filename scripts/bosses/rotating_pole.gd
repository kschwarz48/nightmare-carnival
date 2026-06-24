extends Node2D
## Rotating Pole (05 P2, always-on): the fallen center pole sweeps around the boss
## as a moving wall — constant dodge pressure for the whole phase. Added as a child
## of the boss (so it tracks the boss's position) when Phase 2 begins and freed at
## Phase 3. Damages the player on contact, gated by the player's hit i-frames.

const DMG := 18.0
const SPIN_SPEED := 1.0          # rad/s

@onready var bar_area: Area2D = $BarArea

func _ready() -> void:
	bar_area.collision_layer = CollisionLayers.ENEMY_ATTACK
	bar_area.collision_mask = CollisionLayers.PLAYER_HURTBOX
	bar_area.monitorable = false
	bar_area.monitoring = true
	bar_area.area_entered.connect(_damage)

func _physics_process(delta: float) -> void:
	if GameState.is_paused:
		return
	rotation += SPIN_SPEED * delta
	# Continuous wall: re-apply to anyone still overlapping (i-frames stop spam).
	for a in bar_area.get_overlapping_areas():
		_damage(a)

func _damage(a: Area2D) -> void:
	if a is HurtboxComponent:
		(a as HurtboxComponent).receive(DamageInfo.new(DMG, self, false))
