extends Node2D
## Rotating Pole (05 P2, always-on): the fallen center pole sweeps around the boss
## as a moving wall — constant dodge pressure for the whole phase. Added as a child
## of the boss (so it tracks the boss's position) when Phase 2 begins and freed at
## Phase 3. Damages the player on a fixed interval while overlapping.

const DMG := 18.0
const SPIN_SPEED := 0.85          # rad/s
## HealthComponent has NO i-frames, so this MUST rate-limit itself or it deals
## ~60×/s (an instant kill). Match the standard contact cadence (HitboxComponent
## damage_interval) so it's "ticking" damage, not a one-shot.
const TICK := 0.5

@onready var bar_area: Area2D = $BarArea

var _paused: bool = false          # suspended during the Inhale so they don't stack
var _cool: Dictionary = {}         # HurtboxComponent -> seconds until it can be hit again

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
	for k in _cool.keys():
		if not is_instance_valid(k):
			_cool.erase(k)
			continue
		_cool[k] -= delta
		if _cool[k] <= 0.0:
			_cool.erase(k)
	# Moving wall: tick anyone still overlapping, gated by TICK.
	for a in bar_area.get_overlapping_areas():
		_damage(a)

func _damage(a: Area2D) -> void:
	if a is HurtboxComponent and not _cool.has(a):
		_cool[a] = TICK
		(a as HurtboxComponent).receive(DamageInfo.new(DMG, self, false))
