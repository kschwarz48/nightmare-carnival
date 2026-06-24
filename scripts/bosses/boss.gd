class_name Boss
extends CharacterBody2D
## Boss phase machine (08 §17), programmer-art flavour. The boss is placed
## DORMANT (invulnerable scenery) at run start and wakes at its gate time, then
## slowly roams toward the player, stopping at range to cast. No physical body
## collision (layer/mask 0) so trash never piles on it; it's hit via its hurtbox
## and deals contact via its hitbox.

@onready var visual: Blob = $Visual
@onready var health: HealthComponent = $HealthComponent
@onready var hurtbox: HurtboxComponent = $HurtboxComponent
@onready var hitbox: HitboxComponent = $HitboxComponent
@onready var flash: FlashComponent = $FlashComponent

var data: BossData
var phases: Array[BossPhase] = []
var _phase_index: int = 0
var _last_attack: BossAttack
var _active: bool = false          # dormant scenery until the gate
var _intro_done: bool = false
var _busy: bool = false            # gates the attack loop (one attack at a time)
var _casting: bool = false         # true during telegraph->execute (holds movement)
var _enrage_t: float = 0.0
var _alive: bool = true

func _ready() -> void:
	# No physical collision: enemies don't stick to it, it phases freely.
	collision_layer = 0
	collision_mask = 0
	hurtbox.health_component = health

## Placed dormant at run start (game.gd). Looks like the boss but can't be hurt
## and does nothing until gate_time.
func setup(p_data: BossData) -> void:
	data = p_data
	visual.configure(p_data.color, p_data.radius, Blob.Shape.TENT)
	visual.outline = true
	visual.outline_color = Color(1.0, 0.9, 0.3)
	health.armor = 0.0
	health.set_max_health(p_data.max_health * GameState.difficulty.hp_mult)
	hitbox.damage = p_data.contact_damage
	hurtbox.set_deferred(&"monitorable", false)   # invulnerable while dormant
	hurtbox.set_deferred(&"monitoring", false)
	hitbox.set_deferred(&"monitoring", false)      # no contact damage while dormant
	_enrage_t = p_data.soft_enrage_time

func _physics_process(delta: float) -> void:
	if GameState.is_paused or not _alive:
		return
	if not _active:
		if GameState.is_running and GameState.run_time >= data.gate_time:
			_active = true
			_awaken()
		return
	_enrage_t -= delta
	_update_movement()
	if _intro_done and not _busy:
		_do_attack_loop()

## Warning beat, then the tent comes to life: vulnerable, armed, hunting.
func _awaken() -> void:
	EventBus.boss_warning.emit(data.display_name)
	await get_tree().create_timer(2.0).timeout
	if not is_instance_valid(self) or not _alive:
		return
	hurtbox.set_deferred(&"monitorable", true)
	hitbox.set_deferred(&"monitoring", true)
	health.damaged.connect(flash.flash)
	health.health_changed.connect(_on_health_changed)
	health.died.connect(_on_died)
	phases = _build_phases()
	EventBus.boss_spawned.emit(self, data)
	# Rise/shake intro.
	var base_scale: Vector2 = visual.scale
	visual.scale = base_scale * 0.8
	var tw := create_tween()
	tw.tween_property(visual, "scale", base_scale, 0.6).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	await tw.finished
	_intro_done = true

func _update_movement() -> void:
	if _casting or not _intro_done or not is_instance_valid(GameState.player):
		velocity = Vector2.ZERO
		return
	var to := GameState.player.global_position - global_position
	if to.length() > data.preferred_distance:
		velocity = to.normalized() * data.move_speed
		move_and_slide()
	else:
		velocity = Vector2.ZERO

# --- overridable ---
func _build_phases() -> Array[BossPhase]:
	return []

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
	_casting = true
	await atk.telegraph(self, lead)
	if not _alive: return
	await atk.execute(self)
	_casting = false                       # may reposition during the cooldown
	if not _alive: return
	await get_tree().create_timer(maxf(0.2, atk.cooldown)).timeout
	_busy = false

func _on_health_changed(current: float, maximum: float) -> void:
	var ratio := current / maximum if maximum > 0.0 else 0.0
	if _phase_index + 1 < phases.size() and ratio <= phases[_phase_index + 1].hp_threshold:
		_transition_to(_phase_index + 1)

## Overridable: a phase was just entered (index into `phases`). Subclasses use it
## for persistent per-phase hazards (e.g. the Tent's Rotating Pole).
func _on_phase_entered(_index: int) -> void:
	pass

## Brief invulnerable, busy transition between phases (flash + pause).
func _transition_to(index: int) -> void:
	_phase_index = index
	_on_phase_entered(index)
	_busy = true
	_casting = true
	health.invincible = true
	visual.set_flash(1.0, Color(1, 1, 1))
	await get_tree().create_timer(0.6).timeout
	if not _alive: return
	visual.set_flash(0.0)
	health.invincible = false
	_casting = false
	_busy = false

func _on_died(_info: DamageInfo) -> void:
	if not _alive:
		return
	_alive = false
	set_physics_process(false)
	hurtbox.set_deferred(&"monitorable", false)
	hitbox.set_deferred(&"monitoring", false)
	EventBus.boss_defeated.emit(self, data)
	# Runs inside the killing weapon's hit callback — defer the pool spawns.
	call_deferred(&"_drop_reward", global_position)
	var tw := create_tween()
	tw.tween_property(visual, "scale", Vector2.ZERO, 0.5).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_IN)
	await tw.finished
	queue_free()

## Guaranteed boss chest + a ticket burst (03 §6, 05 shared rules).
func _drop_reward(at: Vector2) -> void:
	var layer := get_parent()
	if layer == null:
		return
	var chest := ObjectPool.acquire(preload("res://scenes/pickups/chest.tscn"), layer)
	chest.global_position = at
	var gem_scene := preload("res://scenes/pickups/ticket_gem.tscn")
	for i in 12:
		var gem := ObjectPool.acquire(gem_scene, layer)
		gem.global_position = at + Vector2.from_angle(randf() * TAU) * randf_range(20.0, 90.0)
		gem.call(&"set_value", 5)
