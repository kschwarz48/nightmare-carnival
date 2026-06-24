class_name DamageInfo
extends RefCounted
## A single damage event (08 §1). Built by attackers, consumed by HealthComponent.

var amount: float = 0.0
var source: Node = null          # who dealt it (thorns, lifesteal, attribution)
var is_crit: bool = false
var knockback: float = 0.0       # knockback-dealt multiplier (0 = none); see Enemy.take_knockback
var damage_type: StringName = &"physical"

func _init(p_amount: float, p_source: Node = null, p_crit: bool = false,
		p_knockback: float = 0.0, p_type: StringName = &"physical") -> void:
	amount = p_amount
	source = p_source
	is_crit = p_crit
	knockback = p_knockback
	damage_type = p_type
