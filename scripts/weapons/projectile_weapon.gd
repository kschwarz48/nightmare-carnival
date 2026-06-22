extends Weapon
## Data-driven shooter (08 §8.2). Handles auto_nearest / auto_random / forward /
## manual aim. Two firing patterns (WeaponData): a simultaneous fan (cards) or a
## consecutive burst that re-aims + scatters each shot (fireworks). Spawns pooled
## Projectiles into the run's ProjectileLayer.

func fire() -> void:
	if data.burst_interval > 0.0:
		_fire_burst(current_amount())
	else:
		_fire_volley(current_amount())

## Simultaneous even fan around a single aim direction.
func _fire_volley(count: int) -> void:
	var origin: Vector2 = GameState.player.global_position
	var base_dir := _aim_direction(origin)
	var half := deg_to_rad(data.spread_angle_deg) * 0.5
	for i in count:
		var offset := 0.0
		if count > 1:
			offset = lerpf(-half, half, float(i) / float(count - 1))
		_spawn_projectile(origin, base_dir.rotated(offset))

## Consecutive shots fired one-by-one. Re-aims per shot (auto_random scatters
## across the crowd) with optional angular jitter — a firework "box".
func _fire_burst(count: int) -> void:
	var half := deg_to_rad(data.spread_angle_deg) * 0.5
	for i in count:
		if GameState.player == null or not GameState.is_running:
			return
		var origin: Vector2 = GameState.player.global_position
		var dir := _aim_direction(origin)
		if data.random_spread:
			dir = dir.rotated(randf_range(-half, half))
		_spawn_projectile(origin, dir)
		if i < count - 1:
			await get_tree().create_timer(data.burst_interval).timeout

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
		_:
			var e := EnemyDirector.get_nearest_enemy(origin, 900.0)
			return origin.direction_to(e.global_position) if e else Vector2.from_angle(randf() * TAU)

func _spawn_projectile(origin: Vector2, dir: Vector2) -> void:
	if data.projectile_scene == null:
		return
	var life := data.lifetime * _stats().duration_mult
	# Jitter range so scattered shots detonate at varied distances, not in a line.
	if data.random_spread:
		life *= randf_range(0.65, 1.25)
	var p := ObjectPool.acquire(data.projectile_scene, _world_layer()) as Projectile
	p.global_position = origin
	p.launch(dir, current_damage(),
		data.projectile_speed_at(level) * _stats().projectile_speed_mult,
		current_area(), data.pierce_at(level), life,
		_stats().roll_crit(), _stats().crit_damage)

func _world_layer() -> Node:
	return get_tree().current_scene.get_node(^"%ProjectileLayer")
