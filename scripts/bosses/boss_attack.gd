class_name BossAttack
extends RefCounted
## One boss attack (08 §17). Subclass per attack: telegraph the danger, then
## execute it. Both are async so an attack can play out over time (await timers
## / physics frames). The boss passes the (enrage-adjusted) lead time.

var weight: float = 1.0
var cooldown: float = 0.6        # minimum gap after this attack
var lead_time: float = 1.0       # telegraph duration — the fairness lever

func telegraph(boss, lead: float) -> void:
	await boss.get_tree().create_timer(lead).timeout

func execute(_boss) -> void:
	pass
