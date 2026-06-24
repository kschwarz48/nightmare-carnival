extends Node2D
## A run (07 §4, 08 §19). Boots GameState, pre-warms pools, spawns the chosen
## character, loads waves, and starts the director. M1 picks defaults from
## ContentDB; the menu/character-select flow arrives at M4.

const PLAYER_SCENE := preload("res://scenes/player/player.tscn")
const ENEMY_SCENE := preload("res://scenes/enemies/enemy.tscn")
const PROJECTILE_SCENE := preload("res://scenes/weapons/projectiles/card.tscn")
const TICKET_SCENE := preload("res://scenes/pickups/ticket_gem.tscn")
const DAMAGE_NUMBER_SCENE := preload("res://scenes/vfx/damage_number.tscn")
const POP_SCENE := preload("res://scenes/vfx/vfx_pop.tscn")
const FIREWORK_SCENE := preload("res://scenes/weapons/projectiles/firework_rocket.tscn")
const EXPLOSION_SCENE := preload("res://scenes/weapons/explosion.tscn")
const RING_SCENE := preload("res://scenes/weapons/projectiles/ring.tscn")
const MELEE_ARC_SCENE := preload("res://scenes/weapons/melee_arc.tscn")
const FOOD_SCENE := preload("res://scenes/pickups/food_pickup.tscn")
const GOLDEN_TICKET_SCENE := preload("res://scenes/pickups/golden_ticket.tscn")
const TELEGRAPH_SCENE := preload("res://scenes/vfx/telegraph_circle.tscn")
const SHOCKWAVE_SCENE := preload("res://scenes/bosses/shockwave.tscn")
const POPCORN_SCENE := preload("res://scenes/bosses/popcorn.tscn")
const CHEST_SCENE := preload("res://scenes/pickups/chest.tscn")

@export var character_id: StringName = &"the_carny"
@export var difficulty_id: StringName = &"midway"

# --- food (heal) spawning (03 §6) ---
## Guaranteed on a randomized interval (not a flat per-roll chance, which gave
## all-or-nothing variance) — a steady-but-occasional lifeline you actually see.
@export var food_interval_min: float = 70.0
@export var food_interval_max: float = 110.0
## Spawn relative to the player so it's on-screen and visible, never on top of them.
@export var food_min_dist: float = 200.0
@export var food_max_dist: float = 470.0

# --- Golden Ticket (rare gem-vacuum, 03 §6) ---
## Much rarer than food — tuned so an average run sees ~1 by the 6:00 gate.
@export var golden_interval_min: float = 280.0
@export var golden_interval_max: float = 440.0

@onready var actor_layer: Node = $ActorLayer
@onready var pickup_layer: Node = %PickupLayer

var _food_timer: float = 0.0
var _golden_timer: float = 0.0

func _ready() -> void:
	var character := ContentDB.get_character(character_id)
	var difficulty := ContentDB.get_difficulty(difficulty_id)
	GameState.start_run(character, difficulty)

	# Register this run's spawn layers so autoloads/weapons can find them (the run
	# is nested under the App root, so it isn't the SceneTree's current_scene).
	GameState.actor_layer = $ActorLayer
	GameState.enemy_layer = %EnemyLayer
	GameState.projectile_layer = %ProjectileLayer
	GameState.pickup_layer = %PickupLayer

	_prewarm()

	var player: Player = PLAYER_SCENE.instantiate()
	player.character_data = character
	actor_layer.add_child(player)
	# Offset from center so the player doesn't start under the dormant tent.
	player.global_position = MapBounds.center() + Vector2(0, 700)

	EnemyDirector.waves = ContentDB.all_waves()
	EnemyDirector.start()

	# Boss schedule is data-driven: every BossData in ContentDB is placed dormant
	# at map center and self-wakes at its own gate_time (08 §17, 05). The Tent is
	# visible scenery (the "this prop IS the boss" reveal); later bosses stay
	# hidden until their gate (BossData.visible_when_dormant).
	for bd: BossData in ContentDB.all_bosses():
		var boss := bd.scene.instantiate()
		boss.global_position = MapBounds.center()
		(get_node(^"%EnemyLayer")).add_child(boss)
		boss.setup(bd)

	# First food comes early (so it's clearly working), then settles to cadence.
	_food_timer = randf_range(30.0, 50.0)
	# First Golden Ticket lands somewhere before/around the 6:00 gate (avg ~1 by then).
	_golden_timer = randf_range(150.0, 330.0)

func _process(delta: float) -> void:
	if not GameState.is_running or GameState.is_paused:
		return
	_food_timer -= delta
	if _food_timer <= 0.0:
		_spawn_food()
		_food_timer = randf_range(food_interval_min, food_interval_max)
	_golden_timer -= delta
	if _golden_timer <= 0.0:
		_spawn_golden_ticket()
		_golden_timer = randf_range(golden_interval_min, golden_interval_max)

## Drop a healing pickup at a random spot around the player — on-screen and
## clearly visible, but a short walk away so grabbing it is a deliberate choice.
func _spawn_food() -> void:
	if GameState.player == null:
		return
	var dir := Vector2.from_angle(randf() * TAU)
	var pos: Vector2 = GameState.player.global_position + dir * randf_range(food_min_dist, food_max_dist)
	pos = pos.clamp(MapBounds.min_pos, MapBounds.max_pos)
	var food := ObjectPool.acquire(FOOD_SCENE, pickup_layer)
	food.global_position = pos

## Drop a Golden Ticket a short walk from the player — rare, and a clear beacon.
func _spawn_golden_ticket() -> void:
	if GameState.player == null:
		return
	var dir := Vector2.from_angle(randf() * TAU)
	var pos: Vector2 = GameState.player.global_position + dir * randf_range(food_min_dist, food_max_dist)
	pos = pos.clamp(MapBounds.min_pos, MapBounds.max_pos)
	var gt := ObjectPool.acquire(GOLDEN_TICKET_SCENE, pickup_layer)
	gt.global_position = pos

func _exit_tree() -> void:
	EnemyDirector.stop()

func _prewarm() -> void:
	ObjectPool.prewarm(ENEMY_SCENE, 320)
	ObjectPool.prewarm(PROJECTILE_SCENE, 120)
	ObjectPool.prewarm(TICKET_SCENE, 450)
	ObjectPool.prewarm(DAMAGE_NUMBER_SCENE, 60)
	ObjectPool.prewarm(POP_SCENE, 40)
	ObjectPool.prewarm(FIREWORK_SCENE, 40)
	ObjectPool.prewarm(EXPLOSION_SCENE, 24)
	ObjectPool.prewarm(RING_SCENE, 24)
	ObjectPool.prewarm(MELEE_ARC_SCENE, 12)
	ObjectPool.prewarm(FOOD_SCENE, 6)
	ObjectPool.prewarm(GOLDEN_TICKET_SCENE, 2)
	ObjectPool.prewarm(TELEGRAPH_SCENE, 16)
	ObjectPool.prewarm(SHOCKWAVE_SCENE, 12)
	ObjectPool.prewarm(POPCORN_SCENE, 40)
	ObjectPool.prewarm(preload("res://scenes/enemies/enemy_projectile.tscn"), 60)
	ObjectPool.prewarm(CHEST_SCENE, 2)
