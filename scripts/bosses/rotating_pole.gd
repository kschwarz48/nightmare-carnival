extends Node2D
## Rotating Pole (05 P2, always-on): the fallen center pole sweeps around the boss
## as a moving wall — constant dodge pressure for the whole phase. Added as a child
## of the boss (so it tracks the boss's position) when Phase 2 begins and freed at
## Phase 3. Damages the player on contact, gated by the player's hit i-frames.

const DMG := 18.0
const SPIN_SPEED := 0.85          # rad/s

@onready var bar_area: Area2D = $BarArea

var _paused: bool = false          # suspended during the Inhale so they don't stack

func _ready() -> void:
	bar_area.collision_layer = CollisionLayers.ENEMY_ATTACK
	bar_area.collision_mask = CollisionLayers.PLAYER_HURTBOX
	bar_area.monitorable = false
	bar_area.monitoring = true
	bar_area.area_entered.connect(_damage)

## Inert (no spin, no damage, dimmed) — the Inhale calls this so being pulled into
## the maw doesn't also mean eating the sweeping pole at the same time.
func set_paused(value: bool) -> void:
	_paused = value
	modulate.a = 0.28 if value else 1.0

func _physics_process(delta: float) -> void:
	if GameState.is_paused or _paused:
		return
	rotation += SPIN_SPEED * delta
	# Continuous wall: re-apply to anyone still overlapping (i-frames stop spam).
	for a in bar_area.get_overlapping_areas():
		_damage(a)

func _damage(a: Area2D) -> void:
	if a is HurtboxComponent:
		(a as HurtboxComponent).receive(DamageInfo.new(DMG, self, false))
