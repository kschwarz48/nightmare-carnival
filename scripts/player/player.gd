class_name Player
extends CharacterBody2D
## The avatar (08 §7). Composes the shared component stack and adds the
## WeaponManager, LevelSystem, pickup magnet and camera.

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

func _ready() -> void:
	collision_layer = CollisionLayers.PLAYER
	collision_mask = CollisionLayers.WORLD
	GameState.player = self

	if character_data:
		stats = character_data.make_stats()
		visual.configure(character_data.color, character_data.radius)
	elif stats == null:
		stats = PlayerStats.new()

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
	var dir := Input.get_vector(&"move_left", &"move_right", &"move_up", &"move_down")
	velocity = dir * stats.move_speed() + external_pull
	move_and_slide()
	_handle_regen(delta)

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

func _on_died(_info: DamageInfo) -> void:
	if stats.revives > 0:
		stats.revives -= 1
		health.revive_to(0.5)
		return
	EventBus.player_died.emit()
	GameState.end_run(false)
