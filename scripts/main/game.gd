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

@export var character_id: StringName = &"the_carny"
@export var difficulty_id: StringName = &"midway"

# --- rare food (heal) spawning (03 §6) ---
## Roll cadence and per-roll chance (kept very low — food is a clutch lifeline,
## not a steady drip). ~one roll every interval; expected one per ~interval/chance s.
@export var food_roll_interval: float = 5.0
@export var food_spawn_chance: float = 0.02
## Spawn relative to the player so it's on-screen and visible, never on top of them.
@export var food_min_dist: float = 200.0
@export var food_max_dist: float = 470.0

@onready var actor_layer: Node = $ActorLayer
@onready var pickup_layer: Node = %PickupLayer

var _food_accum: float = 0.0

func _ready() -> void:
	var character := ContentDB.get_character(character_id)
	var difficulty := ContentDB.get_difficulty(difficulty_id)
	GameState.start_run(character, difficulty)

	_prewarm()

	var player: Player = PLAYER_SCENE.instantiate()
	player.character_data = character
	actor_layer.add_child(player)
	player.global_position = MapBounds.center()

	EnemyDirector.waves = ContentDB.all_waves()
	EnemyDirector.boss_gates = []
	EnemyDirector.start()

func _process(delta: float) -> void:
	if not GameState.is_running or GameState.is_paused:
		return
	_food_accum += delta
	while _food_accum >= food_roll_interval:
		_food_accum -= food_roll_interval
		if randf() < food_spawn_chance:
			_spawn_food()

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

func _exit_tree() -> void:
	EnemyDirector.stop()

func _prewarm() -> void:
	ObjectPool.prewarm(ENEMY_SCENE, 200)
	ObjectPool.prewarm(PROJECTILE_SCENE, 120)
	ObjectPool.prewarm(TICKET_SCENE, 200)
	ObjectPool.prewarm(DAMAGE_NUMBER_SCENE, 60)
	ObjectPool.prewarm(POP_SCENE, 40)
	ObjectPool.prewarm(FIREWORK_SCENE, 40)
	ObjectPool.prewarm(EXPLOSION_SCENE, 24)
	ObjectPool.prewarm(RING_SCENE, 24)
	ObjectPool.prewarm(MELEE_ARC_SCENE, 12)
	ObjectPool.prewarm(FOOD_SCENE, 6)
