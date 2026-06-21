extends Projectile
## Fireworks rocket (06 §2). Reuses the pooled Projectile for travel + lifetime,
## but lobs OVER the crowd (no contact hits) and detonates a pooled Explosion at
## the end of its fuse — a different "shape of fire" from the straight cards.

const EXPLOSION_SCENE := preload("res://scenes/weapons/explosion.tscn")

var _blast_area: float = 1.0

func launch(dir: Vector2, dmg: float, spd: float, area_scale: float,
		p_pierce: int, life: float, crit: bool, crit_dmg: float) -> void:
	super.launch(dir, dmg, spd, area_scale, p_pierce, life, crit, crit_dmg)
	# The blast carries the area; keep the rocket itself small as it arcs.
	_blast_area = area_scale
	scale = Vector2.ONE

func _on_area_entered(_area: Area2D) -> void:
	pass   # lobs past enemies; the explosion does the damage

func _despawn() -> void:
	var ex := ObjectPool.acquire(EXPLOSION_SCENE, get_parent()) as Explosion
	ex.global_position = global_position
	ex.detonate(damage, _blast_area, is_crit, crit_damage)
	super._despawn()
