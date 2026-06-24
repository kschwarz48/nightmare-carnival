class_name Enemy
extends CharacterBody2D
## One scene (enemy.tscn) drives almost all enemies via EnemyData + a behavior
## (08 §10). Pooled — never queue_free()'d.

@onready var visual: Blob = $Visual
@onready var sprite: Blob = $Visual            # alias for behaviors that play anims later
@onready var health: HealthComponent = $HealthComponent
@onready var hurtbox: HurtboxComponent = $HurtboxComponent
@onready var hitbox: HitboxComponent = $HitboxComponent
@onready var flash: FlashComponent = $FlashComponent

var data: EnemyData
var move_speed: float = 60.0
var is_elite: bool = false

var _behavior: EnemyBehavior
var _wired: bool = false

func _ready() -> void:
	collision_layer = CollisionLayers.ENEMY
	# VS-style: collide only with EACH OTHER (no perfect overlap → a fluid wall),
	# but NOT the world — enemies walk straight through obstacles rather than
	# getting stuck on them (no pathfinding). Flyby behaviors opt out entirely.
	collision_mask = CollisionLayers.ENEMY
	hurtbox.health_component = health
	if not _wired:
		health.damaged.connect(flash.flash)
		health.damaged.connect(_on_damaged)
		health.died.connect(_on_died)
		_wired = true

## Called by the director on spawn, with time/difficulty multipliers baked in.
func configure(p_data: EnemyData, hp_mult: float, dmg_mult: float, spd_mult: float,
		elite: bool = false) -> void:
	data = p_data
	is_elite = elite
	var elite_hp := 6.0 if elite else 1.0
	var elite_dmg := 1.5 if elite else 1.0
	var elite_spd := 0.85 if elite else 1.0

	health.armor = 0.0
	health.set_max_health(p_data.max_health * hp_mult * elite_hp)
	hitbox.damage = p_data.contact_damage * dmg_mult * elite_dmg
	move_speed = p_data.move_speed * spd_mult * elite_spd

	visual.configure(p_data.color, p_data.radius, p_data.shape as Blob.Shape)
	visual.outline = elite
	visual.outline_color = Color(1.0, 0.9, 0.2)
	visual.scale = Vector2.ONE * (1.4 if elite else 1.0)
	visual.set_flash(0.0)

	hurtbox.monitoring = false
	hurtbox.monitorable = true
	hitbox.monitoring = true

	# Reset body collision each spawn (pooled reuse), then let the behavior tweak
	# it (flyby zeroes layer+mask so its sweep passes cleanly through the crowd).
	collision_layer = CollisionLayers.ENEMY
	collision_mask = CollisionLayers.ENEMY

	_behavior = EnemyBehavior.create(p_data.behavior)
	_behavior.setup(self)

	GameState.enemies_alive += 1
	EventBus.enemy_spawned.emit(self)

func _physics_process(delta: float) -> void:
	if GameState.is_paused or _behavior == null:
		return
	_behavior.physics_update(self, delta)

## Cheap separation: ask the director's spatial hash (throttled, 08 §12-13).
func separation() -> Vector2:
	return EnemyDirector.separation_for(self)

## Shared chase movement (03 §3): direct vector seek toward `dir` + cheap
## separation (no overlap), then move. No pathfinding — VS-style. Enemies don't
## collide with the world, so they walk through obstacles instead of snagging.
func steer(dir: Vector2, speed_scale: float = 1.0, sep_scale: float = 0.6) -> void:
	velocity = dir * move_speed * speed_scale + separation() * move_speed * sep_scale
	move_and_slide()

func _on_damaged(info: DamageInfo) -> void:
	DamageNumber.spawn(get_parent(), global_position, info.amount, info.is_crit)
	if data and data.hit_sfx != &"":
		AudioManager.play_sfx(data.hit_sfx)

func _on_died(_info: DamageInfo) -> void:
	# Runs inside a hit callback (a projectile/AoE area_entered flush). Stop further
	# hits now, but DEFER the spawns + pool release out of the callback (Godot
	# forbids add_child/remove_child/monitoring changes during a query flush).
	if hurtbox:
		hurtbox.set_deferred(&"monitorable", false)
	if hitbox:
		hitbox.set_deferred(&"monitoring", false)
	set_physics_process(false)
	call_deferred(&"_finish_death", global_position)

func _finish_death(at: Vector2) -> void:
	GameState.enemies_alive -= 1
	GameState.enemies_killed += 1
	_drop_tickets(at)
	if data and data.death_vfx:
		var vfx := ObjectPool.acquire(data.death_vfx, get_parent())
		vfx.global_position = at
	if data and data.death_sfx != &"":
		AudioManager.play_sfx(data.death_sfx)
	EventBus.enemy_died.emit(self, at)
	ObjectPool.release(self)

func _drop_tickets(at: Vector2) -> void:
	# Elites drop a fat (red) gem; GemDirector enforces the ground cap + bank.
	var value: int = data.ticket_value * (5 if is_elite else 1)
	GemDirector.drop(value, at, get_parent())

# Pool hooks. NOTE: prewarm() calls _on_released() before the node ever enters
# the tree, so @onready refs may still be null — guard accordingly.
func _on_released() -> void:
	_behavior = null
	hide()
	set_physics_process(false)
	velocity = Vector2.ZERO
	# Death-triggered release runs inside a collision callback, so defer the
	# Area2D flag changes (Godot blocks them during query flush).
	if hurtbox:
		hurtbox.set_deferred(&"monitoring", false)
		hurtbox.set_deferred(&"monitorable", false)
	if hitbox:
		hitbox.set_deferred(&"monitoring", false)

func _on_acquired() -> void:
	show()
	set_physics_process(true)
	# Re-arm collision via set_deferred so these enables run AFTER any disables
	# still queued by _on_released() in this same frame (a dead enemy can be
	# recycled the same frame it's released). Deferred calls flush in queue
	# order, so the enable here wins over the earlier release's disable —
	# otherwise the recycled enemy's hurtbox stays off and it's unhittable.
	if hurtbox:
		hurtbox.set_deferred(&"monitoring", false)
		hurtbox.set_deferred(&"monitorable", true)
	if hitbox:
		hitbox.set_deferred(&"monitoring", true)
