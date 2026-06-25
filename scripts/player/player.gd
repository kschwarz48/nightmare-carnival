class_name Player
extends CharacterBody2D
## The avatar (08 §7). Composes the shared component stack and adds the
## WeaponManager, LevelSystem, pickup magnet and camera.

const MAX_PASSIVES := 4        # distinct passive items the player can hold (06 §1)

@export var stats: PlayerStats
@export var character_data: CharacterData

@onready var visual: Blob = $Visual
@onready var health: HealthComponent = $HealthComponent
@onready var hurtbox: HurtboxComponent = $HurtboxComponent
@onready var weapon_manager: WeaponManager = $WeaponManager
@onready var level_system: LevelSystem = $LevelSystem
@onready var pickup_magnet: Area2D = $PickupMagnet
@onready var flash: FlashComponent = $FlashComponent
@onready var camera: Camera2D = $Camera2D

## passive upgrade id -> stacks taken (used by UpgradeData legality).
var passive_stacks: Dictionary = {}
## passive id -> level owned (used by EvolutionSystem prerequisite checks).
var passive_levels: Dictionary = {}
## passive id -> PassiveData (so the HUD loadout can show names).
var owned_passives: Dictionary = {}

## External force applied on top of input (e.g. the Tent boss's Inhale pull).
var external_pull: Vector2 = Vector2.ZERO

var _regen_accum: float = 0.0
var _slow_t: float = 0.0
var _slow_factor: float = 1.0

func _ready() -> void:
	collision_layer = CollisionLayers.PLAYER
	collision_mask = CollisionLayers.WORLD
	# Draw above the world layer (enemies, projectiles, orbs, telegraphs) so big
	# self-cast abilities (Saturn's Rings, Crystal Orbs) never hide the player.
	z_index = 20
	GameState.player = self

	if character_data:
		stats = character_data.make_stats()
		visual.configure(character_data.color, character_data.radius)
	elif stats == null:
		stats = PlayerStats.new()
	# Meta perks bought in the Lost & Found apply on top of the character base (01 §9).
	SaveManager.apply_meta_perks(stats)

	hurtbox.health_component = health
	health.set_max_health(stats.max_health())
	health.armor = stats.armor
	health.damaged.connect(flash.flash)
	health.damaged.connect(_on_damaged)
	health.died.connect(_on_died)

	_apply_pickup_radius()
	_apply_camera_limits()

	if character_data and character_data.starting_weapon:
		weapon_manager.add_weapon(character_data.starting_weapon)

func _physics_process(delta: float) -> void:
	if GameState.is_paused:
		return
	var slow := 1.0
	if _slow_t > 0.0:
		_slow_t -= delta
		slow = _slow_factor
	var dir := Input.get_vector(&"move_left", &"move_right", &"move_up", &"move_down")
	velocity = dir * stats.move_speed() * slow + external_pull
	move_and_slide()
	_handle_regen(delta)

## Brief movement slow (Cotton-Candy Slime contact, 04). Strongest active wins.
func apply_slow(factor: float, duration: float) -> void:
	if _slow_t <= 0.0 or factor < _slow_factor:
		_slow_factor = factor
	_slow_t = maxf(_slow_t, duration)

## Re-derive live values after a stat-changing upgrade.
func refresh_stats() -> void:
	health.set_max_health(stats.max_health(), true)
	health.armor = stats.armor
	_apply_pickup_radius()

func _handle_regen(delta: float) -> void:
	if stats.hp_regen <= 0.0:
		return
	_regen_accum += stats.hp_regen * delta
	if _regen_accum >= 1.0:
		var whole := floorf(_regen_accum)
		health.heal(whole)
		_regen_accum -= whole

func _apply_pickup_radius() -> void:
	var cs := pickup_magnet.get_node_or_null(^"CollisionShape2D")
	if cs and cs.shape is CircleShape2D:
		(cs.shape as CircleShape2D).radius = stats.pickup_radius()

func _apply_camera_limits() -> void:
	camera.limit_left = int(MapBounds.min_pos.x)
	camera.limit_top = int(MapBounds.min_pos.y)
	camera.limit_right = int(MapBounds.max_pos.x)
	camera.limit_bottom = int(MapBounds.max_pos.y)

func _on_damaged(info: DamageInfo) -> void:
	EventBus.player_damaged.emit(info.amount, health.current_health)
	if stats.knockback > 0.0:
		_shove_nearby_enemies()
	# Cotton-Candy Slime etc.: contact applies a brief movement slow (04).
	var src = info.source
	if src is Enemy and (src as Enemy).data and (src as Enemy).data.contact_slow > 0.0:
		apply_slow(1.0 - (src as Enemy).data.contact_slow, (src as Enemy).data.contact_slow_time)

## Strongman quirk: when something hits you, shove the enemies pressing on you.
## Reuses the shared knockback (reverse-speed) with a big multiplier (stats.knockback).
func _shove_nearby_enemies() -> void:
	const RADIUS := 80.0
	for e in EnemyDirector._active:
		if not is_instance_valid(e):
			continue
		if e.global_position.distance_to(global_position) < RADIUS:
			e.take_knockback(stats.knockback)

func _on_died(_info: DamageInfo) -> void:
	if stats.revives > 0:
		stats.revives -= 1
		health.revive_to(0.5)
		return
	EventBus.player_died.emit()
	GameState.end_run(false)
