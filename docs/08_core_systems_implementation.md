# 08 · Core Systems Implementation

Ready-to-build GDScript for Godot 4.7. This implements the architecture in `07_godot_architecture.md`. Code is statically typed and follows the conventions in the README/`.cursorrules`. Treat these as **reference implementations** — copy them in, wire the scenes as described, then tune via the `Resource`s.

> **How to use with Cursor:** `@docs/08_core_systems_implementation.md` + the section you want, e.g. "implement the EnemyDirector and SpatialHash from §9." The snippets are designed to drop into the file paths from doc 07 §2.

**Contents:** 1) DamageInfo · 2) HealthComponent · 3) Hurtbox/Hitbox · 4) FlashComponent · 5) GameState · 6) PlayerStats · 7) Player · 8) Weapons & Projectiles · 9) XP/Level/Draft · 10) EnemyData & Enemy · 11) Behaviors · 12) SpatialHash · 13) EnemyDirector · 14) Pickups · 15) ObjectPool · 16) DamageNumber/VFX · 17) Boss framework · 18) SaveManager.

---

## 1. DamageInfo (the damage packet)

```gdscript
# scripts/systems/damage_info.gd
class_name DamageInfo
extends RefCounted
## A single damage event. Built by attackers, consumed by HealthComponent.

var amount: float = 0.0
var source: Node = null          # who dealt it (for thorns, lifesteal, attribution)
var is_crit: bool = false
var knockback: Vector2 = Vector2.ZERO
var damage_type: StringName = &"physical"   # "fire", "frost", etc. for resist/DoT hooks

func _init(p_amount: float, p_source: Node = null, p_crit: bool = false,
		p_knockback: Vector2 = Vector2.ZERO, p_type: StringName = &"physical") -> void:
	amount = p_amount
	source = p_source
	is_crit = p_crit
	knockback = p_knockback
	damage_type = p_type
```

---

## 2. HealthComponent

One component owns an actor's HP. Players, enemies, bosses, and boss sub-targets all use it.

```gdscript
# scripts/components/health_component.gd
class_name HealthComponent
extends Node

signal health_changed(current: float, maximum: float)
signal damaged(info: DamageInfo)          # fired before death; drives flash + damage numbers
signal died(info: DamageInfo)
signal healed(amount: float)

@export var max_health: float = 10.0
@export var armor: float = 0.0            # flat reduction per hit, min 1 dmg
@export var invincible: bool = false

var current_health: float

func _ready() -> void:
	current_health = max_health

func take_damage(info: DamageInfo) -> void:
	if invincible or current_health <= 0.0:
		return
	var dealt: float = maxf(1.0, info.amount - armor)
	current_health -= dealt
	# Re-pack the actual dealt amount so listeners (damage numbers) show the real value.
	info.amount = dealt
	damaged.emit(info)
	health_changed.emit(current_health, max_health)
	if current_health <= 0.0:
		died.emit(info)

func heal(amount: float) -> void:
	if current_health <= 0.0:
		return
	current_health = minf(current_health + amount, max_health)
	healed.emit(amount)
	health_changed.emit(current_health, max_health)

func set_max_health(value: float, keep_ratio: bool = false) -> void:
	var ratio := current_health / max_health if max_health > 0.0 else 1.0
	max_health = value
	current_health = max_health * ratio if keep_ratio else max_health
	health_changed.emit(current_health, max_health)

func get_ratio() -> float:
	return current_health / max_health if max_health > 0.0 else 0.0
```

---

## 3. HurtboxComponent & HitboxComponent

The **Hurtbox receives** damage (wraps a HealthComponent). The **Hitbox deals** damage by scanning for hurtboxes. See collision wiring in doc 07 §6.

```gdscript
# scripts/components/hurtbox_component.gd
class_name HurtboxComponent
extends Area2D
## Passive receiver. layer = (PLAYER_HURTBOX or ENEMY_HURTBOX), mask = 0, monitorable = true.

@export var health_component: HealthComponent

func _ready() -> void:
	monitoring = false        # hurtboxes are scanned BY hitboxes; they don't scan
	monitorable = true

func receive(info: DamageInfo) -> void:
	if health_component:
		health_component.take_damage(info)
```

```gdscript
# scripts/components/hitbox_component.gd
class_name HitboxComponent
extends Area2D
## Active dealer used for CONTACT damage (enemy bodies). Projectiles handle their own hits.
## layer = (ENEMY_ATTACK or PLAYER_ATTACK), mask = the opposing *_HURTBOX, monitoring = true.

@export var damage: float = 10.0
@export var damage_interval: float = 0.5   # re-tick the same target every N seconds (contact)
@export var knockback_force: float = 0.0

var _cooldowns: Dictionary = {}            # HurtboxComponent -> time_left

func _ready() -> void:
	area_entered.connect(_on_area_entered)

func _physics_process(delta: float) -> void:
	# Tick down per-target cooldowns; iterate a copy of keys so we can erase safely.
	for hurtbox in _cooldowns.keys():
		if not is_instance_valid(hurtbox):
			_cooldowns.erase(hurtbox)
			continue
		_cooldowns[hurtbox] -= delta
		if _cooldowns[hurtbox] <= 0.0 and overlaps_area(hurtbox):
			_hit(hurtbox)

func _on_area_entered(area: Area2D) -> void:
	if area is HurtboxComponent and not _cooldowns.has(area):
		_hit(area)

func _hit(hurtbox: HurtboxComponent) -> void:
	var kb := Vector2.ZERO
	if knockback_force > 0.0:
		kb = (hurtbox.global_position - global_position).normalized() * knockback_force
	hurtbox.receive(DamageInfo.new(damage, owner, false, kb))
	_cooldowns[hurtbox] = damage_interval
```

---

## 4. FlashComponent (hit feedback / juice)

Drives a white-flash shader on a sprite when the actor takes damage. Pair every actor's `HealthComponent.damaged` to it.

```gdscript
# scripts/components/flash_component.gd
class_name FlashComponent
extends Node
## Works with a ShaderMaterial `flash` uniform (0..1) OR a programmer-art visual
## exposing set_flash(float). Connect: health.damaged.connect(flash_component.flash)

## GOTCHA: use a NodePath export, NOT `@export var sprite: CanvasItem`. A scene
## that stores `sprite = NodePath("../Visual")` assigned to a node-typed export
## silently fails to resolve (stays null) → flash never fires. Resolve in _ready.
@export var sprite_path: NodePath = ^"../Visual"
@export var flash_time: float = 0.10
@export var squash: float = 0.82          # quick squash on hit for extra juice

var sprite: CanvasItem
var _t: float = 0.0
var _base_scale: Vector2 = Vector2.ONE

func _ready() -> void:
	sprite = get_node_or_null(sprite_path) as CanvasItem
	if sprite:
		_base_scale = sprite.scale
	set_process(false)

func flash(_info: DamageInfo = null) -> void:
	_t = flash_time
	_set_flash(1.0)
	if sprite:
		sprite.scale = _base_scale * Vector2(1.0 / squash, squash)
	set_process(true)

func _set_flash(value: float) -> void:
	if sprite == null:
		return
	if sprite.material is ShaderMaterial:
		(sprite.material as ShaderMaterial).set_shader_parameter("flash", value)
	elif sprite.has_method(&"set_flash"):
		sprite.call(&"set_flash", value)

func _process(delta: float) -> void:
	_t -= delta
	if sprite:
		sprite.scale = sprite.scale.lerp(_base_scale, 1.0 - exp(-18.0 * delta))
	if _t <= 0.0:
		_set_flash(0.0)
		if sprite:
			sprite.scale = _base_scale
		set_process(false)
```

Minimal flash shader (assign to enemy/player sprite materials):

```glsl
// assets/shaders/flash.gdshader
shader_type canvas_item;
uniform float flash : hint_range(0.0, 1.0) = 0.0;
uniform vec4 flash_color : source_color = vec4(1.0);
void fragment() {
    vec4 tex = texture(TEXTURE, UV);
    COLOR = mix(tex, vec4(flash_color.rgb, tex.a), flash * tex.a);
}
```

---

## 5. GameState (autoload)

The run's single source of truth. Enemies read `GameState.player.global_position` (no searching).

```gdscript
# scripts/autoload/game_state.gd   (Autoload name: GameState)
extends Node

var player: Node2D = null
var difficulty: DifficultyData
var character: CharacterData

var run_time: float = 0.0          # seconds elapsed this run
var is_running: bool = false
var is_paused: bool = false

var enemies_alive: int = 0
var enemies_killed: int = 0
var bosses_killed: int = 0
var tickets: int = 0               # in-run XP currency total collected (for stats)
var gold: int = 0

func _process(delta: float) -> void:
	if is_running and not is_paused:
		run_time += delta

func run_minutes() -> float:
	return run_time / 60.0

func start_run(p_character: CharacterData, p_difficulty: DifficultyData) -> void:
	character = p_character
	difficulty = p_difficulty
	run_time = 0.0
	is_running = true
	is_paused = false
	enemies_alive = 0
	enemies_killed = 0
	bosses_killed = 0
	tickets = 0
	gold = 0
	EventBus.run_started.emit(p_character, p_difficulty)

func end_run(did_win: bool) -> void:
	is_running = false
	var stats := {
		"won": did_win,
		"time": run_time,
		"kills": enemies_killed,
		"bosses": bosses_killed,
	}
	EventBus.run_ended.emit(did_win, stats)

func set_paused(value: bool) -> void:
	is_paused = value
	get_tree().paused = value
	EventBus.request_pause.emit(value)
```

---

## 6. PlayerStats (Resource)

All player combat stats in one resource. Passives/level-ups/meta modify the `*_add`/`*_mult` accumulators; `recalculate()` produces the final values weapons read.

```gdscript
# scripts/data/player_stats.gd
class_name PlayerStats
extends Resource

# --- base values (from CharacterData) ---
@export var base_max_health: float = 100.0
@export var base_move_speed: float = 110.0
@export var base_pickup_radius: float = 60.0

# --- accumulators (modified by passives/upgrades/meta) ---
var might_mult: float = 1.0
var cooldown_mult: float = 1.0          # < 1.0 = faster
var area_mult: float = 1.0
var duration_mult: float = 1.0
var projectile_speed_mult: float = 1.0
var amount_add: int = 0
var crit_chance: float = 0.05
var crit_damage: float = 2.0
var armor: float = 0.0
var luck: float = 1.0
var greed: float = 1.0
var xp_gain_mult: float = 1.0
var hp_regen: float = 0.0
var revives: int = 0

var max_health_add: float = 0.0
var max_health_mult: float = 1.0
var move_speed_mult: float = 1.0
var pickup_radius_mult: float = 1.0

# --- computed (read by gameplay) ---
func max_health() -> float: return (base_max_health + max_health_add) * max_health_mult
func move_speed() -> float: return base_move_speed * move_speed_mult
func pickup_radius() -> float: return base_pickup_radius * pickup_radius_mult

func roll_crit() -> bool:
	# Luck nudges crit slightly; tune the coefficient.
	return randf() < crit_chance * (0.5 + 0.5 * luck)

## Apply a passive's per-level effect. Called by the level system.
func apply_passive(axis: StringName, magnitude: float) -> void:
	match axis:
		&"might": might_mult += magnitude
		&"cooldown": cooldown_mult = maxf(0.25, cooldown_mult - magnitude)
		&"area": area_mult += magnitude
		&"duration": duration_mult += magnitude
		&"projectile_speed": projectile_speed_mult += magnitude
		&"amount": amount_add += int(magnitude)
		&"crit_chance": crit_chance += magnitude
		&"crit_damage": crit_damage += magnitude
		&"armor": armor += magnitude
		&"luck": luck += magnitude
		&"greed": greed += magnitude
		&"xp": xp_gain_mult += magnitude
		&"regen": hp_regen += magnitude
		&"max_health": max_health_mult += magnitude
		&"move_speed": move_speed_mult += magnitude
		&"pickup": pickup_radius_mult += magnitude
		&"revive": revives += int(magnitude)
		_: push_warning("Unknown stat axis: %s" % axis)
```

---

## 7. Player

```gdscript
# scripts/player/player.gd
class_name Player
extends CharacterBody2D

@export var stats: PlayerStats
@export var character_data: CharacterData

@onready var health: HealthComponent = $HealthComponent
@onready var hurtbox: HurtboxComponent = $HurtboxComponent
@onready var weapon_manager: Node = $WeaponManager
@onready var level_system: Node = $LevelSystem
@onready var pickup_magnet: Area2D = $PickupMagnet
@onready var flash: FlashComponent = $FlashComponent

var _regen_accum: float = 0.0

func _ready() -> void:
	GameState.player = self
	if character_data:
		stats = character_data.make_stats()      # fresh per-run copy
	health.set_max_health(stats.max_health())
	health.armor = stats.armor
	health.damaged.connect(flash.flash)
	health.damaged.connect(_on_damaged)
	health.died.connect(_on_died)
	_apply_pickup_radius()
	# Equip starting weapon (see WeaponManager).
	if character_data and character_data.starting_weapon:
		weapon_manager.add_weapon(character_data.starting_weapon)

func _physics_process(delta: float) -> void:
	var dir := Input.get_vector(&"move_left", &"move_right", &"move_up", &"move_down")
	velocity = dir * stats.move_speed()
	move_and_slide()
	_handle_regen(delta)
	if dir != Vector2.ZERO and has_node("Sprite2D"):
		$Sprite2D.flip_h = dir.x < 0.0   # face movement

func _handle_regen(delta: float) -> void:
	if stats.hp_regen <= 0.0:
		return
	_regen_accum += stats.hp_regen * delta
	if _regen_accum >= 1.0:
		var whole := floorf(_regen_accum)
		health.heal(whole)
		_regen_accum -= whole

func _apply_pickup_radius() -> void:
	# Assumes PickupMagnet/CollisionShape2D is a CircleShape2D.
	var shape := pickup_magnet.get_node("CollisionShape2D").shape as CircleShape2D
	if shape:
		shape.radius = stats.pickup_radius()

func _on_damaged(info: DamageInfo) -> void:
	EventBus.player_damaged.emit(info.amount, health.current_health)
	# camera shake / chromatic-aberration hook here

func _on_died(_info: DamageInfo) -> void:
	if stats.revives > 0:
		stats.revives -= 1
		health.current_health = health.max_health * 0.5
		health.health_changed.emit(health.current_health, health.max_health)
		# i-frames VFX here
		return
	EventBus.player_died.emit()
	GameState.end_run(false)
```

---

## 8. Weapons & Projectiles

> **`WeaponData` schema** — the accessors used throughout this section. Per-level deltas are summed cumulatively up to the current level; tune them in the `.tres` (see `06_weapons_and_upgrades.md §7`).

```gdscript
# scripts/data/weapon_data.gd
class_name WeaponData
extends Resource

@export var id: StringName = &""
@export var display_name: String = ""
@export var description: String = ""
@export var style: StringName = &"projectile"      # projectile/orbit/melee/summon → selects Weapon script
@export var aim_mode: StringName = &"auto_nearest"  # auto_nearest/auto_random/forward/manual
@export var projectile_scene: PackedScene
@export var icon: Texture2D
@export var max_level: int = 8
# base stats
@export var base_damage: float = 10.0
@export var base_cooldown: float = 1.0
@export var base_area: float = 1.0
@export var base_amount: int = 1
@export var base_projectile_speed: float = 400.0
@export var base_pierce: int = 0
@export var lifetime: float = 2.0
# firing pattern (ProjectileWeapon)
@export var spread_angle_deg: float = 24.0   # total fan width for a simultaneous volley
@export var burst_interval: float = 0.0      # >0: fire shots consecutively, this far apart (1-by-1)
@export var random_spread: bool = false      # random angle + range per shot → scattered impacts
# per-level deltas (index 0 unused; summed cumulatively — see fireworks.tres in doc 06 §7)
@export var level_damage: Array[float] = []
@export var level_cooldown: Array[float] = []
@export var level_area: Array[float] = []
@export var level_amount: Array[int] = []
# evolution linkage (doc 06 §5)
@export var evolution: Resource           # EvolutionData
@export var required_passive: StringName = &""

func _sum_f(arr: Array, lvl: int) -> float:
	var t := 0.0
	for i in mini(lvl, arr.size()): t += arr[i]
	return t

func damage_at(lvl: int) -> float:    return base_damage + _sum_f(level_damage, lvl)
func cooldown_at(lvl: int) -> float:  return maxf(0.1, base_cooldown + _sum_f(level_cooldown, lvl))
func area_at(lvl: int) -> float:      return base_area + _sum_f(level_area, lvl)
func amount_at(lvl: int) -> int:      return base_amount + int(_sum_f(level_amount, lvl))
func projectile_speed_at(_lvl: int) -> float: return base_projectile_speed
func pierce_at(_lvl: int) -> int:     return base_pierce
```

### 8.1 Weapon base + WeaponManager

```gdscript
# scripts/weapons/weapon.gd
class_name Weapon
extends Node2D

@export var data: WeaponData
var level: int = 1
var _cd: float = 0.0

func setup(p_data: WeaponData) -> void:
	data = p_data
	_cd = current_cooldown()

func _process(delta: float) -> void:
	if GameState.is_paused:
		return
	_cd -= delta
	if _cd <= 0.0:
		fire()
		_cd = current_cooldown()

# --- helpers reading the live player stats ---
func _stats() -> PlayerStats: return (GameState.player as Player).stats
func current_cooldown() -> float: return data.cooldown_at(level) * _stats().cooldown_mult
func current_damage() -> float: return data.damage_at(level) * _stats().might_mult
func current_amount() -> int: return data.amount_at(level) + _stats().amount_add
func current_area() -> float: return data.area_at(level) * _stats().area_mult

func level_up() -> void:
	level = mini(level + 1, data.max_level)

func fire() -> void:
	push_error("Weapon.fire() must be overridden")  # see ProjectileWeapon, OrbitWeapon, etc.
```

```gdscript
# scripts/player/weapon_manager.gd
extends Node
## Holds active Weapon child nodes; one slot per weapon (max 6, doc 06 §1).

const MAX_WEAPONS := 6
const PROJECTILE_WEAPON := preload("res://scripts/weapons/projectile_weapon.gd")
# map aim/style -> weapon script (extend as you add styles)
const WEAPON_SCRIPTS := {
	&"projectile": preload("res://scripts/weapons/projectile_weapon.gd"),
	&"orbit": preload("res://scripts/weapons/orbit_weapon.gd"),
	&"melee": preload("res://scripts/weapons/melee_weapon.gd"),
	&"summon": preload("res://scripts/weapons/summon_weapon.gd"),
}

var weapons: Dictionary = {}   # weapon_id -> Weapon

func has_room() -> bool: return weapons.size() < MAX_WEAPONS

func has_weapon(id: StringName) -> bool: return weapons.has(id)

func add_weapon(wdata: WeaponData) -> void:
	if weapons.has(wdata.id):
		(weapons[wdata.id] as Weapon).level_up()
		return
	if not has_room():
		return
	var script: GDScript = WEAPON_SCRIPTS.get(wdata.style, PROJECTILE_WEAPON)
	var w: Weapon = script.new()      # script extends Weapon (which extends Node2D)
	add_child(w)
	w.setup(wdata)
	weapons[wdata.id] = w

func level_up_weapon(id: StringName) -> void:
	if weapons.has(id):
		(weapons[id] as Weapon).level_up()
```

### 8.2 Generic ProjectileWeapon (covers most weapons via data)

```gdscript
# scripts/weapons/projectile_weapon.gd
extends Weapon
## Data-driven shooter. Handles aim_mode = auto_nearest / auto_random / forward / manual.

func fire() -> void:
	var origin: Vector2 = GameState.player.global_position
	var count := current_amount()
	var base_dir := _aim_direction(origin)
	# Spread multiple projectiles in a small fan.
	var spread := deg_to_rad(12.0)
	for i in count:
		var offset: float = 0.0
		if count > 1:
			offset = lerpf(-spread, spread, float(i) / float(count - 1))
		_spawn_projectile(origin, base_dir.rotated(offset))

func _aim_direction(origin: Vector2) -> Vector2:
	match data.aim_mode:
		&"forward":
			var v: Vector2 = GameState.player.velocity
			return v.normalized() if v.length() > 1.0 else Vector2.RIGHT
		&"manual":
			return origin.direction_to(GameState.player.get_global_mouse_position())
		&"auto_random":
			var e := EnemyDirector.get_random_enemy_near(origin, 600.0)
			return origin.direction_to(e.global_position) if e else Vector2.from_angle(randf() * TAU)
		_: # auto_nearest
			var e := EnemyDirector.get_nearest_enemy(origin, 900.0)
			return origin.direction_to(e.global_position) if e else Vector2.from_angle(randf() * TAU)

func _spawn_projectile(origin: Vector2, dir: Vector2) -> void:
	var p := ObjectPool.acquire(data.projectile_scene, _world_layer()) as Projectile
	p.global_position = origin
	p.launch(dir, current_damage(), data.projectile_speed_at(level) * _stats().projectile_speed_mult,
		current_area(), data.pierce_at(level), data.lifetime * _stats().duration_mult,
		_stats().roll_crit(), _stats().crit_damage)

func _world_layer() -> Node:
	return get_tree().current_scene.get_node(^"%ProjectileLayer")  # a Node2D in game.tscn (unique name)
```

> **Two firing patterns.** The above is the simultaneous **fan** (`spread_angle_deg`). When `burst_interval > 0`, `fire()` instead spawns the shots **consecutively** (`await get_tree().create_timer(burst_interval).timeout` between each), re-aiming per shot — with `auto_random` this scatters rockets across the crowd (Fireworks). `random_spread` adds per-shot angle + range jitter so impacts don't form a line. Lobbed projectiles (`firework_rocket.gd extends Projectile`) reset rotation and offset their visual on a parabola for a readable **arc**, then spawn a pooled `Explosion` (AoE) on fuse end instead of hitting on contact.

### 8.3 Projectile (pooled)

```gdscript
# scripts/weapons/projectile.gd
class_name Projectile
extends Area2D
## layer = PLAYER_ATTACK, mask = ENEMY_HURTBOX, monitoring = true. Pooled.

@onready var _sprite: Node2D = $Sprite2D

var direction: Vector2 = Vector2.RIGHT
var speed: float = 400.0
var damage: float = 10.0
var pierce: int = 0
var lifetime: float = 2.0
var is_crit: bool = false
var crit_damage: float = 2.0

var _life: float = 0.0
var _hit: Array = []     # hurtboxes already hit (no double-tap during pierce)

func _ready() -> void:
	collision_layer = CollisionLayers.PLAYER_ATTACK
	collision_mask = CollisionLayers.ENEMY_HURTBOX
	area_entered.connect(_on_area_entered)

func launch(dir: Vector2, dmg: float, spd: float, area_scale: float,
		p_pierce: int, life: float, crit: bool, crit_dmg: float) -> void:
	direction = dir.normalized()
	damage = dmg
	speed = spd
	pierce = p_pierce
	lifetime = life
	is_crit = crit
	crit_damage = crit_dmg
	_life = lifetime
	_hit.clear()
	rotation = direction.angle()
	scale = Vector2.ONE * area_scale
	monitoring = true
	show()

func _physics_process(delta: float) -> void:
	global_position += direction * speed * delta
	_life -= delta
	if _life <= 0.0:
		_despawn()

func _on_area_entered(area: Area2D) -> void:
	if area is HurtboxComponent and not _hit.has(area):
		_hit.append(area)
		var dmg := damage * (crit_damage if is_crit else 1.0)
		area.receive(DamageInfo.new(dmg, self, is_crit))
		if pierce <= 0:
			_despawn()
		else:
			pierce -= 1

func _despawn() -> void:
	monitoring = false
	ObjectPool.release(self)

# Pool hooks
func _on_released() -> void:
	monitoring = false
	hide()
	set_physics_process(false)
func _on_acquired() -> void:
	set_physics_process(true)
```

> **Other weapon styles** (`orbit_weapon.gd`, `melee_weapon.gd`, `summon_weapon.gd`) follow the same shape: override `fire()` (or maintain persistent child attack nodes for orbit/aura). Orbit: spawn N `OrbitAttack` nodes that rotate around the player and carry a HitboxComponent. Melee: spawn a short-lived arc `Area2D` with a HitboxComponent. Summon: instance a minion scene that runs a light `ChaserBehavior` + its own ProjectileWeapon. Reuse `current_damage()/current_area()/current_amount()` so player stats flow through uniformly.

---

## 9. XP, Leveling & the Draft

### 9.1 LevelSystem

```gdscript
# scripts/player/level_system.gd
extends Node
## Tracks XP/level; opens the draft on level-up. Listens to ticket pickups.

var level: int = 1
var xp: float = 0.0
var xp_to_next: float = 5.0

func _ready() -> void:
	EventBus.ticket_collected.connect(_on_ticket)

func _on_ticket(value: int) -> void:
	var gain := float(value) * (GameState.player as Player).stats.xp_gain_mult
	xp += gain
	GameState.tickets += value
	while xp >= xp_to_next:
		xp -= xp_to_next
		_level_up()

func _level_up() -> void:
	level += 1
	xp_to_next = _curve(level)
	EventBus.player_leveled_up.emit(level)   # → DraftGenerator/UI opens the draft

func _curve(lvl: int) -> float:
	# Gentle early, steepening later. Tune freely (it's the pacing of choices).
	return 5.0 + float(lvl) * 3.0 + pow(float(lvl), 1.6)
```

### 9.2 DraftGenerator (offer building, doc 06 §4)

```gdscript
# scripts/systems/draft_generator.gd
class_name DraftGenerator
extends RefCounted

## Build N legal, weighted, distinct upgrade options for the level-up draft.
static func generate(count: int) -> Array[UpgradeData]:
	var player := GameState.player as Player
	var wm := player.weapon_manager
	var pool: Array = []                    # [{ "data": UpgradeData, "weight": float }]

	for up: UpgradeData in ContentDB.all_upgrades():
		if not up.is_legal(wm, player):     # respects slot caps & max levels
			continue
		var w := up.base_weight * up.rarity_weight(player.stats.luck)
		w *= up.relevance_bonus(wm)         # light bias toward current build
		pool.append({ "data": up, "weight": w })

	# Guarantee an evolution card if any prerequisite is met.
	var evo := EvolutionSystem.find_ready_evolution(wm, player.stats)
	var picks: Array[UpgradeData] = []
	if evo:
		picks.append(evo)
		count -= 1

	picks.append_array(_weighted_sample(pool, count))
	return picks

static func _weighted_sample(pool: Array, n: int) -> Array[UpgradeData]:
	var result: Array[UpgradeData] = []
	var working := pool.duplicate()
	for _i in n:
		if working.is_empty():
			break
		var total := 0.0
		for item in working: total += item.weight
		var r := randf() * total
		var acc := 0.0
		for j in working.size():
			acc += working[j].weight
			if r <= acc:
				result.append(working[j].data)
				working.remove_at(j)
				break
	return result
```

> `ContentDB` is a small autoload/static cache that `load()`s every `.tres` from `resources/` once (use `DirAccess` to scan folders) and exposes typed lists. `UpgradeData.is_legal/rarity_weight/relevance_bonus` and `EvolutionSystem.find_ready_evolution` are thin helpers; their bodies follow directly from doc 06 §4–5 rules. The **LevelUpDraft UI** (`scenes/ui/level_up_draft.tscn`) listens to `EventBus.player_leveled_up`, pauses via `GameState.set_paused(true)`, calls `DraftGenerator.generate(3 or 4)`, shows the cards, and on pick applies the upgrade (add/level weapon or apply passive) then unpauses.

---

## 10. EnemyData & the generic Enemy

```gdscript
# scripts/data/enemy_data.gd
class_name EnemyData
extends Resource

@export var id: StringName = &""
@export var display_name: String = ""
@export var max_health: float = 10.0
@export var move_speed: float = 60.0
@export var contact_damage: float = 8.0
@export var ticket_value: int = 1
@export var behavior: StringName = &"chaser"        # maps to a behavior script (§11)
@export var sprite_frames: SpriteFrames
@export var separation_radius: float = 14.0
@export var can_be_elite: bool = true
@export var death_vfx: PackedScene
@export var hit_sfx: StringName = &""
@export var death_sfx: StringName = &""
## Optional per-behavior tuning bag (e.g., charge_speed, shoot_range, burst_cooldown).
@export var params: Dictionary = {}
```

```gdscript
# scripts/enemies/enemy.gd
class_name Enemy
extends CharacterBody2D
## One scene (enemy.tscn) drives almost all enemies via EnemyData + a behavior. Pooled.

@onready var sprite: AnimatedSprite2D = $AnimatedSprite2D
@onready var health: HealthComponent = $HealthComponent
@onready var hurtbox: HurtboxComponent = $HurtboxComponent
@onready var hitbox: HitboxComponent = $HitboxComponent
@onready var flash: FlashComponent = $FlashComponent

var data: EnemyData
var move_speed: float = 60.0
var is_elite: bool = false

var _behavior: EnemyBehavior
var _ticket_scene: PackedScene = preload("res://scenes/pickups/ticket_gem.tscn")

func _ready() -> void:
	health.damaged.connect(flash.flash)
	health.died.connect(_on_died)

## Called by the director on spawn, with time/difficulty multipliers baked in.
func configure(p_data: EnemyData, hp_mult: float, dmg_mult: float, spd_mult: float,
		elite: bool = false) -> void:
	data = p_data
	is_elite = elite
	var elite_hp := 6.0 if elite else 1.0
	var elite_dmg := 1.5 if elite else 1.0
	var elite_spd := 0.85 if elite else 1.0
	health.set_max_health(p_data.max_health * hp_mult * elite_hp)
	hitbox.damage = p_data.contact_damage * dmg_mult * elite_dmg
	move_speed = p_data.move_speed * spd_mult * elite_spd
	sprite.sprite_frames = p_data.sprite_frames
	sprite.play(&"move")
	sprite.scale = Vector2.ONE * (1.4 if elite else 1.0)
	hurtbox.monitoring = false
	hurtbox.monitorable = true
	_behavior = EnemyBehavior.create(p_data.behavior)
	_behavior.setup(self)
	GameState.enemies_alive += 1
	EventBus.enemy_spawned.emit(self)

func _physics_process(delta: float) -> void:
	if _behavior:
		_behavior.physics_update(self, delta)

## Cheap separation: ask the director's spatial hash for a few neighbors (throttled by §12).
func separation() -> Vector2:
	return EnemyDirector.separation_for(self)

func _on_died(info: DamageInfo) -> void:
	GameState.enemies_alive -= 1
	GameState.enemies_killed += 1
	_drop_tickets()
	if data.death_vfx:
		var vfx := ObjectPool.acquire(data.death_vfx, get_parent())
		vfx.global_position = global_position
	if data.death_sfx != &"":
		AudioManager.play_sfx(data.death_sfx)
	EventBus.enemy_died.emit(self, global_position)
	ObjectPool.release(self)

func _drop_tickets() -> void:
	var gem := ObjectPool.acquire(_ticket_scene, get_parent())
	gem.global_position = global_position
	gem.set_value(data.ticket_value)

# Pool hooks
func _on_released() -> void:
	hide(); set_physics_process(false); hurtbox.monitoring = false; hitbox.monitoring = false
func _on_acquired() -> void:
	show(); set_physics_process(true); hitbox.monitoring = true
```

---

## 11. Enemy behaviors (composable AI)

Behaviors are lightweight `RefCounted` objects (no per-enemy node overhead). One file per behavior (doc 04 names). A factory maps the `behavior` key to a script.

```gdscript
# scripts/enemies/behaviors/enemy_behavior.gd
class_name EnemyBehavior
extends RefCounted

const REGISTRY := {
	&"chaser": preload("res://scripts/enemies/behaviors/chaser_behavior.gd"),
	&"erratic_chaser": preload("res://scripts/enemies/behaviors/erratic_chaser_behavior.gd"),
	&"flyby": preload("res://scripts/enemies/behaviors/flyby_behavior.gd"),  # cross-screen "dodge" swarm
	&"burst_charger": preload("res://scripts/enemies/behaviors/burst_charger_behavior.gd"),
	&"shooter": preload("res://scripts/enemies/behaviors/shooter_behavior.gd"),
	&"line_charger": preload("res://scripts/enemies/behaviors/line_charger_behavior.gd"),
	&"rail_strafer": preload("res://scripts/enemies/behaviors/rail_strafer_behavior.gd"),
	&"spawner": preload("res://scripts/enemies/behaviors/spawner_behavior.gd"),
	&"ambusher": preload("res://scripts/enemies/behaviors/ambusher_behavior.gd"),
	&"pop_up": preload("res://scripts/enemies/behaviors/pop_up_behavior.gd"),
}

static func create(key: StringName) -> EnemyBehavior:
	var script: GDScript = REGISTRY.get(key, REGISTRY[&"chaser"])
	return script.new()

func setup(_enemy: Enemy) -> void: pass
func physics_update(_enemy: Enemy, _delta: float) -> void: pass

# Shared helper: vector toward the player.
func to_player(enemy: Enemy) -> Vector2:
	return enemy.global_position.direction_to(GameState.player.global_position)
```

```gdscript
# scripts/enemies/behaviors/chaser_behavior.gd
class_name ChaserBehavior
extends EnemyBehavior
## Living Balloon, Possessed Stuffie, Cotton-Candy Slime. Steer at player + separation.

func physics_update(enemy: Enemy, _delta: float) -> void:
	var desired := to_player(enemy) * enemy.move_speed
	enemy.velocity = desired + enemy.separation() * enemy.move_speed * 0.6
	enemy.move_and_slide()
```

```gdscript
# scripts/enemies/behaviors/line_charger_behavior.gd
class_name LineChargerBehavior
extends EnemyBehavior
## Carousel Horse, Bumper Car. Approach → telegraph → commit a straight-line charge.

enum State { APPROACH, WINDUP, CHARGE, RECOVER }
var _state: int = State.APPROACH
var _t: float = 0.0
var _dir: Vector2 = Vector2.RIGHT

func physics_update(enemy: Enemy, delta: float) -> void:
	var p := enemy.data.params
	var charge_speed: float = p.get("charge_speed", 230.0)
	var windup_time: float = p.get("windup_time", 0.6)
	var charge_time: float = p.get("charge_time", 0.7)
	match _state:
		State.APPROACH:
			enemy.velocity = to_player(enemy) * enemy.move_speed + enemy.separation() * enemy.move_speed * 0.4
			enemy.move_and_slide()
			if enemy.global_position.distance_to(GameState.player.global_position) < 280.0:
				_state = State.WINDUP; _t = windup_time
				enemy.sprite.play(&"attack_windup")
		State.WINDUP:
			enemy.velocity = Vector2.ZERO
			_t -= delta
			if _t <= 0.0:
				_dir = to_player(enemy)          # lock direction at end of windup
				_state = State.CHARGE; _t = charge_time
				enemy.sprite.play(&"attack")
		State.CHARGE:
			enemy.velocity = _dir * charge_speed
			enemy.move_and_slide()
			_t -= delta
			if _t <= 0.0:
				_state = State.RECOVER; _t = 0.5
				enemy.sprite.play(&"idle")
		State.RECOVER:
			enemy.velocity = enemy.velocity.lerp(Vector2.ZERO, 0.1)
			enemy.move_and_slide()
			_t -= delta
			if _t <= 0.0:
				_state = State.APPROACH
				enemy.sprite.play(&"move")
```

```gdscript
# scripts/enemies/behaviors/shooter_behavior.gd
class_name ShooterBehavior
extends EnemyBehavior
## Dunk-Tank Clown, Puppet Soldier. Keep preferred range; fire telegraphed projectiles.

var _cd: float = 0.0

func setup(enemy: Enemy) -> void:
	_cd = enemy.data.params.get("shoot_cooldown", 2.0)

func physics_update(enemy: Enemy, delta: float) -> void:
	var p := enemy.data.params
	var range_ideal: float = p.get("range", 320.0)
	var dist := enemy.global_position.distance_to(GameState.player.global_position)
	var dir := to_player(enemy)
	if dist > range_ideal + 40.0:
		enemy.velocity = dir * enemy.move_speed
	elif dist < range_ideal - 40.0:
		enemy.velocity = -dir * enemy.move_speed          # kite away
	else:
		enemy.velocity = enemy.separation() * enemy.move_speed
	enemy.move_and_slide()
	_cd -= delta
	if _cd <= 0.0 and dist < range_ideal + 120.0:
		_cd = p.get("shoot_cooldown", 2.0)
		_shoot(enemy, dir)

func _shoot(enemy: Enemy, dir: Vector2) -> void:
	enemy.sprite.play(&"attack")
	var scene: PackedScene = enemy.data.params.get("projectile_scene", null)
	if scene == null:
		return
	var proj := ObjectPool.acquire(scene, enemy.get_parent())   # an EnemyProjectile (mask=PLAYER_HURTBOX)
	proj.global_position = enemy.global_position
	proj.launch(dir, enemy.data.params.get("projectile_damage", 8.0),
		enemy.data.params.get("projectile_speed", 220.0))
```

> The remaining behaviors (`burst_charger`, `erratic_chaser`, `rail_strafer`, `spawner`, `ambusher`, `pop_up`, plus `formation` as a coordinator) follow the same `State`-enum + `params`-driven pattern. `rail_strafer`: flash a rail line (telegraph VFX) → tween the head along it → segments trail via a recorded position history. `spawner`: on a timer, `ObjectPool.acquire` weak enemies and `configure()` them. `ambusher`/`pop_up`: timed invuln windows toggling `hurtbox.monitorable`. Keep all tuning in `EnemyData.params` so they stay data-driven.

---

## 12. SpatialHash (cheap neighbor queries for separation)

Hundreds of enemies can't each scan all others (O(n²)). A uniform-grid spatial hash rebuilt once per physics frame gives near-O(n) neighbor lookups. Owned by the director.

```gdscript
# scripts/systems/spatial_hash.gd
class_name SpatialHash
extends RefCounted

var cell_size: float = 48.0
var _grid: Dictionary = {}     # Vector2i -> Array[Node2D]

func _key(pos: Vector2) -> Vector2i:
	return Vector2i(floori(pos.x / cell_size), floori(pos.y / cell_size))

func rebuild(nodes: Array) -> void:
	_grid.clear()
	for n in nodes:
		if not is_instance_valid(n):
			continue
		var k := _key(n.global_position)
		if not _grid.has(k):
			_grid[k] = []
		_grid[k].append(n)

## Neighbors in the 3x3 block of cells around pos.
func query(pos: Vector2) -> Array:
	var out: Array = []
	var base := _key(pos)
	for dx in range(-1, 2):
		for dy in range(-1, 2):
			var cell: Array = _grid.get(base + Vector2i(dx, dy), [])
			out.append_array(cell)
	return out
```

---

## 13. EnemyDirector (autoload)

The run's pulse: spawn ring, wave selection, time/difficulty scaling, population cap, elites, boss gates, and the separation service. Reads `WaveData`/`DifficultyData` resources (doc 03 §7).

```gdscript
# scripts/autoload/enemy_director.gd   (Autoload name: EnemyDirector)
extends Node

const ENEMY_SCENE := preload("res://scenes/enemies/enemy.tscn")

@export var spawn_margin: float = 64.0
var waves: Array[WaveData] = []          # loaded from resources/waves/, sorted by start time
var boss_gates: Array = []               # [{ "time": 360.0, "boss": BossData, "fired": false }, ...]

var _spawn_accum: float = 0.0
var _active: Array = []                  # active enemies (for hash + cap + queries)
var _hash := SpatialHash.new()
var _frame: int = 0
var _running: bool = false

func start() -> void:
	_active.clear()
	for g in boss_gates: g.fired = false
	_running = true
	EventBus.boss_defeated.connect(_on_boss_defeated)

func _physics_process(delta: float) -> void:
	if not _running or GameState.is_paused or not GameState.is_running:
		return
	_frame += 1
	_hash.rebuild(_active)
	_check_boss_gates()
	_spawn_step(delta)

# --- spawning ---
func _spawn_step(delta: float) -> void:
	var minutes := GameState.run_minutes()
	var rate := _spawns_per_second(minutes)
	_spawn_accum += rate * delta
	while _spawn_accum >= 1.0:
		_spawn_accum -= 1.0
		if _active.size() >= _cap():
			_recycle_farthest()
		_spawn_one(minutes)

func _spawn_one(minutes: float) -> void:
	var ed := _pick_enemy(minutes)
	if ed == null:
		return
	var e := ObjectPool.acquire(ENEMY_SCENE, _enemy_layer()) as Enemy
	e.global_position = _ring_point()
	var elite := randf() < _elite_chance(minutes) and ed.can_be_elite
	e.configure(ed, _hp_mult(minutes), _dmg_mult(minutes), _spd_mult(minutes), elite)
	_active.append(e)

func _ring_point() -> Vector2:
	var cam := GameState.player.global_position
	var view := get_viewport().get_visible_rect().size
	var radius := view.length() * 0.5 + spawn_margin
	var angle := randf() * TAU
	var pt := cam + Vector2.from_angle(angle) * radius
	# Clamp into map bounds (set these from world.tscn).
	return pt.clamp(MapBounds.min_pos, MapBounds.max_pos)

func _pick_enemy(minutes: float) -> EnemyData:
	# Gather active waves at this time, weighted-sample one enemy.
	var total := 0.0
	var entries: Array = []
	for w: WaveData in waves:
		if minutes * 60.0 >= w.start_time and minutes * 60.0 < w.end_time:
			for pair in w.weighted_enemies():     # [[EnemyData, weight], ...]
				entries.append(pair); total += pair[1]
	if entries.is_empty():
		return null
	var r := randf() * total
	var acc := 0.0
	for pair in entries:
		acc += pair[1]
		if r <= acc:
			return pair[0]
	return entries.back()[0]

# --- scaling (doc 03 §7.3); pull tier mults from GameState.difficulty ---
func _spawns_per_second(minutes: float) -> float:
	return GameState.difficulty.base_spawn_rate * (1.0 + 0.05 * minutes)
func _hp_mult(minutes: float) -> float:
	return (1.0 + 0.06 * minutes) * GameState.difficulty.hp_mult
func _dmg_mult(minutes: float) -> float:
	return (1.0 + 0.04 * minutes) * GameState.difficulty.dmg_mult
func _spd_mult(minutes: float) -> float:
	return minf(1.0 + 0.01 * minutes, 1.6)
func _elite_chance(minutes: float) -> float:
	return clampf(0.01 + 0.004 * minutes, 0.0, 0.12)
func _cap() -> int:
	return GameState.difficulty.max_alive

func _recycle_farthest() -> void:
	var p := GameState.player.global_position
	var worst: Enemy = null
	var worst_d := -1.0
	for e in _active:
		if not is_instance_valid(e): continue
		var d := e.global_position.distance_squared_to(p)
		if d > worst_d:
			worst_d = d; worst = e
	if worst:
		_remove(worst); ObjectPool.release(worst)

# --- bosses ---
func _check_boss_gates() -> void:
	var t := GameState.run_time
	for g in boss_gates:
		if not g.fired and t >= g.time:
			g.fired = true
			_spawn_boss(g.boss)

func _spawn_boss(bdata: BossData) -> void:
	AudioManager.set_intensity(1.0)
	var boss := bdata.scene.instantiate() as Boss
	_enemy_layer().add_child(boss)
	boss.global_position = _ring_point()
	boss.configure(bdata)
	EventBus.boss_spawned.emit(boss, bdata)

func _on_boss_defeated(_boss: Node, _bdata: BossData) -> void:
	GameState.bosses_killed += 1
	# director resumes the next act's wave table automatically (time-based).

# --- separation service (called by enemies, throttled) ---
func separation_for(enemy: Enemy) -> Vector2:
	# Throttle: each enemy recomputes every 3rd frame, offset by instance id.
	if (_frame + enemy.get_instance_id()) % 3 != 0:
		return enemy.get_meta(&"_sep", Vector2.ZERO)
	var push := Vector2.ZERO
	var r := enemy.data.separation_radius
	for other in _hash.query(enemy.global_position):
		if other == enemy or not is_instance_valid(other):
			continue
		var diff: Vector2 = enemy.global_position - other.global_position
		var d := diff.length()
		if d > 0.0 and d < r:
			push += diff / d * (1.0 - d / r)
	enemy.set_meta(&"_sep", push)
	return push

# --- queries for weapons (auto-aim) ---
func get_nearest_enemy(from: Vector2, max_dist: float) -> Node2D:
	var best: Node2D = null
	var best_d := max_dist * max_dist
	for e in _hash.query(from):       # local first; widen if you need true-nearest
		if not is_instance_valid(e): continue
		var d := from.distance_squared_to(e.global_position)
		if d < best_d:
			best_d = d; best = e
	return best

func get_random_enemy_near(from: Vector2, radius: float) -> Node2D:
	var near := _hash.query(from)
	return near.pick_random() if not near.is_empty() else null

func _remove(e: Enemy) -> void:
	var i := _active.find(e)
	if i != -1: _active.remove_at(i)

func _enemy_layer() -> Node:
	return get_tree().current_scene.get_node(^"%EnemyLayer")
```

> `MapBounds` is a tiny autoload (or static) set from `world.tscn` holding `min_pos`/`max_pos`. `WaveData.weighted_enemies()` returns its enemy/weight pairs. Hook `EventBus.enemy_died` (already emitted by `Enemy`) so the director prunes `_active`.
>
> **Spawn model (implemented):** the `_spawn_step` shown above is the early rate-based sketch. The shipped director is **wave-driven** (VS-style, 03 §7.2/§7.4): pick the single latest-started active `WaveData`, **top up** to its `min_alive` every tick, then add `spawn_batch` every `spawn_interval` up to `min(wave.max_alive, difficulty.max_alive)`. Per-enemy stat scaling (`_hp_mult`/`_dmg_mult`/`_spd_mult`) still applies on top; spawn *count* comes entirely from the wave timeline, not a global rate.

---

## 14. Pickups (TicketGem + magnet)

```gdscript
# scripts/pickups/ticket_gem.gd
class_name TicketGem
extends Area2D
## layer = PICKUP, mask = 0 (the player's magnet scans it). Pooled.

var value: int = 1
var _magnetized: bool = false
var _speed: float = 0.0

func _ready() -> void:
	collision_layer = CollisionLayers.PICKUP
	collision_mask = 0
	monitorable = true

func set_value(v: int) -> void:
	value = v
	# swap frame/scale by tier here if desired

func magnetize() -> void:
	_magnetized = true

func _physics_process(delta: float) -> void:
	if _magnetized and is_instance_valid(GameState.player):
		_speed = minf(_speed + 1400.0 * delta, 900.0)
		global_position = global_position.move_toward(GameState.player.global_position, _speed * delta)
		if global_position.distance_to(GameState.player.global_position) < 12.0:
			_collect()

func _collect() -> void:
	EventBus.ticket_collected.emit(value)
	AudioManager.play_sfx(&"ticket_pickup")
	ObjectPool.release(self)

func _on_released() -> void:
	_magnetized = false; _speed = 0.0; hide(); set_physics_process(false); monitorable = false
func _on_acquired() -> void:
	show(); set_physics_process(true); monitorable = true
```

The player's **PickupMagnet** (Area2D, layer `PICKUP_MAGNET`, mask `PICKUP`) calls `magnetize()` on entry:

```gdscript
# on the player's PickupMagnet node
func _ready() -> void:
	area_entered.connect(func(a): if a is TicketGem: a.magnetize())
```

---

## 15. ObjectPool (autoload)

Reuse instances instead of `instantiate()/queue_free()` churn. Pooled scenes optionally implement `_on_acquired()` / `_on_released()`.

```gdscript
# scripts/autoload/object_pool.gd   (Autoload name: ObjectPool)
extends Node

var _pools: Dictionary = {}        # scene_path: String -> Array[Node]

func acquire(scene: PackedScene, parent: Node) -> Node:
	var key := scene.resource_path
	var stack: Array = _pools.get(key, [])
	var node: Node
	if stack.size() > 0:
		node = stack.pop_back()
	else:
		node = scene.instantiate()
		node.set_meta(&"_pool_key", key)
	parent.add_child(node)
	if node.has_method(&"_on_acquired"):
		node.call(&"_on_acquired")
	return node

func release(node: Node) -> void:
	if not is_instance_valid(node):
		return
	if node.has_method(&"_on_released"):
		node.call(&"_on_released")
	if node.get_parent():
		node.get_parent().remove_child(node)
	var key: String = node.get_meta(&"_pool_key", "")
	if key == "":
		node.queue_free()
		return
	if not _pools.has(key):
		_pools[key] = []
	_pools[key].append(node)

## Optional: pre-warm pools at run start to avoid first-spawn hitches.
func prewarm(scene: PackedScene, count: int) -> void:
	var key := scene.resource_path
	if not _pools.has(key): _pools[key] = []
	for _i in count:
		var n := scene.instantiate()
		n.set_meta(&"_pool_key", key)
		if n.has_method(&"_on_released"): n.call(&"_on_released")
		_pools[key].append(n)
```

> **Pooling contract:** never `queue_free()` a pooled node — always `ObjectPool.release()`. In `_on_released()` fully reset state (hide, disable processing, clear timers/targets, `monitoring=false`). In `_on_acquired()` re-enable. Pre-warm enemies, the main projectiles, ticket gems, damage numbers, and the common pop VFX at run start.

---

## 16. DamageNumber & one-shot VFX (pooled)

```gdscript
# scripts/vfx/damage_number.gd
class_name DamageNumber
extends Node2D
## Pooled floating number. Cap concurrent instances (see note) to protect frame-time.

@onready var label: Label = $Label
var _t: float = 0.0
var _vel: Vector2

func show_number(amount: float, is_crit: bool) -> void:
	label.text = str(int(round(amount)))
	label.modulate = Color(1, 0.85, 0.2) if is_crit else Color(1, 1, 1)
	scale = Vector2.ONE * (1.4 if is_crit else 1.0)
	_vel = Vector2(randf_range(-20, 20), -60)
	_t = 0.6
	set_process(true)

func _process(delta: float) -> void:
	_t -= delta
	position += _vel * delta
	_vel.y += 90.0 * delta
	modulate.a = clampf(_t / 0.6, 0.0, 1.0)
	if _t <= 0.0:
		ObjectPool.release(self)

func _on_released() -> void: hide(); set_process(false)
func _on_acquired() -> void: show(); modulate.a = 1.0
```

Spawn them by listening to `HealthComponent.damaged` on enemies (wire in `enemy.gd._ready()` if you want numbers): acquire a `DamageNumber`, place at the enemy, call `show_number(info.amount, info.is_crit)`. **Cap** concurrent numbers (e.g., 60); when exceeded, skip or aggregate — at bullet-heaven scale they're a real cost.

> Generic one-shot VFX (`vfx_pop.tscn`, `vfx_confetti.tscn`): a `GPUParticles2D` (one-shot) + optional `AnimatedSprite2D`; on `finished`/timer, `ObjectPool.release(self)`. Telegraph VFX (`telegraph_circle.tscn`) are the same but tween a growing danger-color shape over an `@export lead_time` then release.

---

## 17. Boss framework (phase machine + attack pattern)

Bosses reuse the actor stack (Health/Hurtbox/Hitbox/Flash) and add a **phase state machine** whose phases hold **attack pools**. Attacks are objects with `telegraph()`/`execute()` so adding one is data-like.

```gdscript
# scripts/bosses/boss_attack.gd
class_name BossAttack
extends RefCounted
## One boss attack. Subclass per attack, or configure via params.

var weight: float = 1.0
var cooldown: float = 0.0        # minimum gap after this attack
var lead_time: float = 1.0       # telegraph duration (the fairness lever)

func telegraph(_boss: Boss) -> void:
	await _boss.get_tree().create_timer(lead_time).timeout

func execute(_boss: Boss) -> void:
	pass
```

```gdscript
# scripts/bosses/boss_phase.gd
class_name BossPhase
extends RefCounted

var hp_threshold: float = 1.0           # enter when ratio <= previous, exit when <= this
var attacks: Array[BossAttack] = []
var add_spawn_interval: float = 0.0     # 0 = no adds in this phase
var enter_anim: StringName = &""

func pick_attack(last: BossAttack) -> BossAttack:
	# weighted, avoid immediate repeat
	var pool := attacks.duplicate()
	if last and pool.size() > 1:
		pool.erase(last)
	var total := 0.0
	for a in pool: total += a.weight
	var r := randf() * total
	var acc := 0.0
	for a in pool:
		acc += a.weight
		if r <= acc: return a
	return pool.back()
```

```gdscript
# scripts/bosses/boss.gd
class_name Boss
extends CharacterBody2D

@onready var sprite: AnimatedSprite2D = $AnimatedSprite2D
@onready var health: HealthComponent = $HealthComponent
@onready var hurtbox: HurtboxComponent = $HurtboxComponent
@onready var flash: FlashComponent = $FlashComponent

var data: BossData
var phases: Array[BossPhase] = []
var _phase_index: int = 0
var _last_attack: BossAttack
var _busy: bool = false
var _enrage_t: float = 0.0

func configure(p_data: BossData) -> void:
	data = p_data
	phases = p_data.build_phases()           # constructs BossPhase/BossAttack objects
	health.set_max_health(p_data.max_health * GameState.difficulty.hp_mult)
	health.damaged.connect(flash.flash)
	health.health_changed.connect(_on_health_changed)
	health.died.connect(_on_died)
	sprite.sprite_frames = p_data.sprite_frames
	_enrage_t = p_data.soft_enrage_time
	_run_intro()

func _run_intro() -> void:
	_busy = true
	sprite.play(&"intro")
	await sprite.animation_finished
	_busy = false

func _physics_process(delta: float) -> void:
	if GameState.is_paused or _busy:
		return
	_enrage_t -= delta
	if not _busy:
		_do_attack_loop()

func _do_attack_loop() -> void:
	_busy = true
	var phase := phases[_phase_index]
	var atk := phase.pick_attack(_last_attack)
	_last_attack = atk
	if _enrage_t <= 0.0:
		atk.lead_time *= 0.7              # Encore: faster telegraphs
	await atk.telegraph(self)
	await atk.execute(self)
	await get_tree().create_timer(maxf(0.2, atk.cooldown)).timeout
	_busy = false

func _on_health_changed(current: float, maximum: float) -> void:
	var ratio := current / maximum
	# advance phase when crossing the next threshold
	if _phase_index + 1 < phases.size() and ratio <= phases[_phase_index + 1].hp_threshold:
		_transition_to(_phase_index + 1)

func _transition_to(index: int) -> void:
	_phase_index = index
	_busy = true
	var ph := phases[index]
	if ph.enter_anim != &"":
		sprite.play(ph.enter_anim)
		await sprite.animation_finished
	_busy = false

func _on_died(_info: DamageInfo) -> void:
	sprite.play(&"defeat")
	EventBus.boss_defeated.emit(self, data)
	# spawn guaranteed chest + ticket burst (doc 05 shared rules)
	await sprite.animation_finished
	queue_free()
```

Example concrete attack (Carnival Tent stomp, doc 05):

```gdscript
# scripts/bosses/attacks/tent_stomp.gd
extends BossAttack
func _init() -> void:
	weight = 2.0; cooldown = 0.6; lead_time = 1.0

func telegraph(boss: Boss) -> void:
	var marker := ObjectPool.acquire(preload("res://scenes/vfx/telegraph_circle.tscn"), boss.get_parent())
	marker.global_position = GameState.player.global_position    # stomp where the player IS now
	marker.set_meta(&"lead_time", lead_time)
	await boss.get_tree().create_timer(lead_time).timeout
	boss.set_meta(&"_stomp_pos", marker.global_position)

func execute(boss: Boss) -> void:
	var pos: Vector2 = boss.get_meta(&"_stomp_pos")
	# spawn a damaging shockwave Area2D at pos (layer ENEMY_ATTACK, mask PLAYER_HURTBOX)
	var wave := ObjectPool.acquire(preload("res://scenes/bosses/shockwave.tscn"), boss.get_parent())
	wave.global_position = pos
	boss.sprite.play(&"atk_stomp")
```

> `BossData.build_phases()` is where each boss's phases/attacks/thresholds from doc 05 are assembled (in code, or parsed from sub-resources). Sub-targets (Puppet King strings, Ferris gondolas) are child `HurtboxComponent`+`HealthComponent` nodes; on their `died`, emit through the boss to trigger stagger/phase logic.

---

## 18. SaveManager (meta-progression persistence)

```gdscript
# scripts/autoload/save_manager.gd   (Autoload name: SaveManager)
extends Node

const SAVE_PATH := "user://nightmare_carnival.save"

var meta := {
	"lost_tickets": 0,
	"unlocks": [],            # ids of unlocked characters/weapons/zones
	"perks": {},              # perk_id -> level
	"pedia": [],              # discovered enemy/boss ids
	"settings": {},
}

func _ready() -> void:
	load_game()

func add_lost_tickets(amount: int) -> void:
	meta.lost_tickets += amount
	save_game()

func is_unlocked(id: StringName) -> bool:
	return meta.unlocks.has(String(id))

func unlock(id: StringName) -> void:
	if not is_unlocked(id):
		meta.unlocks.append(String(id))
		save_game()

func discover(id: StringName) -> void:
	if not meta.pedia.has(String(id)):
		meta.pedia.append(String(id)); save_game()

func save_game() -> void:
	var f := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(meta))

func load_game() -> void:
	if not FileAccess.file_exists(SAVE_PATH):
		return
	var f := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if f:
		var parsed: Variant = JSON.parse_string(f.get_as_text())
		if parsed is Dictionary:
			meta.merge(parsed, true)
```

Award Lost Tickets on `EventBus.run_ended` using the payout formula in doc 01 §8, then `SaveManager.add_lost_tickets(...)`. First-time `boss_defeated`/`enemy_died` can call `SaveManager.discover(...)` and `unlock(...)`.

---

## 19. Putting it together — boot sequence & wiring checklist

**Run start (`game.tscn._ready()`):**
1. `GameState.start_run(character, difficulty)`.
2. `ObjectPool.prewarm()` enemies, main projectiles, ticket gems, damage numbers, pop VFX.
3. Instance the chosen character at map center; it sets `GameState.player`.
4. `EnemyDirector.waves = ...` (loaded from `resources/waves/`), set `boss_gates`, `EnemyDirector.start()`.
5. HUD connects to `EventBus` signals (`time_tick`, `player_leveled_up`, `player_damaged`, `boss_spawned`).

**Signal wiring quick map:**
- `HealthComponent.damaged` → `FlashComponent.flash` (+ optional DamageNumber spawn).
- `HealthComponent.died` → owner cleanup → `ObjectPool.release` (enemies) / `GameState.end_run` (player).
- `EventBus.ticket_collected` → `LevelSystem`.
- `EventBus.player_leveled_up` → LevelUpDraft UI (pause → `DraftGenerator.generate` → apply → unpause).
- `EventBus.boss_defeated` → director (count, chest), `SaveManager` (unlock/discover).
- `EventBus.run_ended` → ResultsScreen + Lost-Ticket payout.

**Minimum test loop (prove it's fun, doc 09 M1):** player moves → ProjectileWeapon auto-fires → enemies spawn from the ring, chase, die, drop gems → gems magnetize → XP → draft → pick → power up. Get *that* feeling right before anything else.

---

## 20. Testing & verification hooks

- **On-screen debug overlay:** FPS, `GameState.enemies_alive`, pool sizes, `run_time`. Watch entity budget vs. caps (doc 03 §7.2).
- **Godot profiler** passes at 100 / 300 / 600 enemies; the SpatialHash rebuild and `move_and_slide` loops are the usual hot spots.
- **Determinism for daily runs:** seed `RandomNumberGenerator` from the daily seed; route gameplay randomness through it (not bare `randf()`) when building the Daily mode.
- **Balance unit tests (GUT or simple scripts):** assert `WeaponData` curves are monotonic where intended; assert payout formula; assert every `EvolutionData` references a valid base weapon + passive id; assert every `EnemyData.behavior` exists in the behavior registry.
- **Soak test:** auto-play a bot that just dodges for 25 minutes to catch leaks (pool growth should plateau) and late-game frame drops.

> Cross-references: data resources & autoload registration → `07_godot_architecture.md` · content the resources describe → `04`/`05`/`06` · spawn/scaling design values → `03 §7` · build order for all of the above → `09_build_roadmap.md`.
