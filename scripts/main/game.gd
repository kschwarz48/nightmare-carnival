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

@export var character_id: StringName = &"the_carny"
@export var difficulty_id: StringName = &"midway"

@onready var actor_layer: Node = $ActorLayer

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

func _exit_tree() -> void:
	EnemyDirector.stop()

func _prewarm() -> void:
	ObjectPool.prewarm(ENEMY_SCENE, 200)
	ObjectPool.prewarm(PROJECTILE_SCENE, 120)
	ObjectPool.prewarm(TICKET_SCENE, 200)
	ObjectPool.prewarm(DAMAGE_NUMBER_SCENE, 60)
	ObjectPool.prewarm(POP_SCENE, 40)
