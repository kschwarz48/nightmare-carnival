extends Weapon
## Data-driven shooter (08 §8.2). Handles auto_nearest / auto_random / forward /
## manual aim. Spawns pooled Projectiles into the run's ProjectileLayer.

func fire() -> void:
	var origin: Vector2 = GameState.player.global_position
	var count := current_amount()
	var base_dir := _aim_direction(origin)
	var spread := deg_to_rad(12.0)
	for i in count:
		var offset := 0.0
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
		_:
			var e := EnemyDirector.get_nearest_enemy(origin, 900.0)
			return origin.direction_to(e.global_position) if e else Vector2.from_angle(randf() * TAU)

func _spawn_projectile(origin: Vector2, dir: Vector2) -> void:
	if data.projectile_scene == null:
		return
	var p := ObjectPool.acquire(data.projectile_scene, _world_layer()) as Projectile
	p.global_position = origin
	p.launch(dir, current_damage(),
		data.projectile_speed_at(level) * _stats().projectile_speed_mult,
		current_area(), data.pierce_at(level), data.lifetime * _stats().duration_mult,
		_stats().roll_crit(), _stats().crit_damage)

func _world_layer() -> Node:
	return get_tree().current_scene.get_node(^"%ProjectileLayer")
