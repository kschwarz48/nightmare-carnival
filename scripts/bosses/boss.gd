class_name Boss
extends CharacterBody2D
## Boss phase machine (08 §17), programmer-art flavour. Reuses the actor stack;
## a Blob stands in for the AnimatedSprite2D and tweens stand in for intro/phase
## anims. Subclasses override _build_phases() (and optionally the arena hooks).

@onready var visual: Blob = $Visual
@onready var health: HealthComponent = $HealthComponent
@onready var hurtbox: HurtboxComponent = $HurtboxComponent
@onready var hitbox: HitboxComponent = $HitboxComponent
@onready var flash: FlashComponent = $FlashComponent

var data: BossData
var phases: Array[BossPhase] = []
var _phase_index: int = 0
var _last_attack: BossAttack
var _busy: bool = true            # gates the attack loop (true during intro/transition)
var _enrage_t: float = 0.0
var _alive: bool = true

func _ready() -> void:
	collision_layer = CollisionLayers.ENEMY
	collision_mask = CollisionLayers.WORLD
	hurtbox.health_component = health

## Called by the director after the scene is added to the tree.
func configure(p_data: BossData) -> void:
	data = p_data
	visual.configure(p_data.color, p_data.radius, Blob.Shape.SQUARE)
	visual.outline = true
	visual.outline_color = Color(1.0, 0.9, 0.3)
	health.armor = 0.0
	health.set_max_health(p_data.max_health * GameState.difficulty.hp_mult)
	hitbox.damage = p_data.contact_damage
	hurtbox.monitoring = false
	hurtbox.monitorable = true
	hitbox.monitoring = true
	health.damaged.connect(flash.flash)
	health.health_changed.connect(_on_health_changed)
	health.died.connect(_on_died)
	_enrage_t = p_data.soft_enrage_time
	phases = _build_phases()
	_on_spawn()
	_run_intro()

# --- overridable hooks ---
func _build_phases() -> Array[BossPhase]:
	return []

func _on_spawn() -> void:
	pass

func _on_despawn() -> void:
	pass

func _run_intro() -> void:
	_busy = true
	var base_scale: Vector2 = visual.scale
	visual.scale = base_scale * 0.2
	var tw := create_tween()
	tw.tween_property(visual, "scale", base_scale, 0.7).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	await tw.finished
	_busy = false

func _physics_process(delta: float) -> void:
	if GameState.is_paused or not _alive:
		return
	_enrage_t -= delta
	if not _busy:
		_do_attack_loop()

func _do_attack_loop() -> void:
	_busy = true
	var phase := phases[_phase_index]
	var atk := phase.pick_attack(_last_attack)
	if atk == null:
		_busy = false
		return
	_last_attack = atk
	var lead := atk.lead_time
	if _enrage_t <= 0.0:
		lead *= 0.7                        # Encore: faster telegraphs
	await atk.telegraph(self, lead)
	if not _alive: return
	await atk.execute(self)
	if not _alive: return
	await get_tree().create_timer(maxf(0.2, atk.cooldown)).timeout
	_busy = false

func _on_health_changed(current: float, maximum: float) -> void:
	var ratio := current / maximum if maximum > 0.0 else 0.0
	if _phase_index + 1 < phases.size() and ratio <= phases[_phase_index + 1].hp_threshold:
		_transition_to(_phase_index + 1)

## Brief invulnerable, busy transition between phases (flash + pause).
func _transition_to(index: int) -> void:
	_phase_index = index
	_busy = true
	health.invincible = true
	visual.set_flash(1.0, Color(1, 1, 1))
	await get_tree().create_timer(0.6).timeout
	if not _alive: return
	visual.set_flash(0.0)
	health.invincible = false
	_busy = false

func _on_died(_info: DamageInfo) -> void:
	if not _alive:
		return
	_alive = false
	set_physics_process(false)
	hurtbox.set_deferred(&"monitorable", false)
	hitbox.set_deferred(&"monitoring", false)
	_on_despawn()
	EventBus.boss_defeated.emit(self, data)
	_drop_reward()
	# Quick deflate, then free (the attack coroutine bails on _alive == false).
	var tw := create_tween()
	tw.tween_property(visual, "scale", Vector2.ZERO, 0.5).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_IN)
	await tw.finished
	queue_free()

## Guaranteed boss chest + a ticket burst (03 §6, 05 shared rules).
func _drop_reward() -> void:
	var chest := ObjectPool.acquire(preload("res://scenes/pickups/chest.tscn"), get_parent())
	chest.global_position = global_position
	var gem_scene := preload("res://scenes/pickups/ticket_gem.tscn")
	for i in 12:
		var gem := ObjectPool.acquire(gem_scene, get_parent())
		gem.global_position = global_position + Vector2.from_angle(randf() * TAU) * randf_range(20.0, 90.0)
		gem.call(&"set_value", 5)
