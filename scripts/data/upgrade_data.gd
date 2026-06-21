class_name UpgradeData
extends Resource
## A single draftable option (06 §4, 08 §9). Wraps a new weapon, a weapon
## level-up, or a passive (stacking). The draft generator filters by is_legal()
## and applies the choice via apply().

enum Kind { NEW_WEAPON, LEVEL_WEAPON, PASSIVE }

@export var id: StringName = &""
@export var display_name: String = ""
@export var description: String = ""
@export var kind: Kind = Kind.PASSIVE
@export var base_weight: float = 1.0

# NEW_WEAPON / LEVEL_WEAPON
@export var weapon: WeaponData
# PASSIVE
@export var passive: PassiveData
@export var max_stacks: int = 5

## Is this a valid offer for the current build state?
func is_legal(player: Player) -> bool:
	var wm := player.weapon_manager
	match kind:
		Kind.NEW_WEAPON:
			return weapon != null and not wm.has_weapon(weapon.id) and wm.has_room()
		Kind.LEVEL_WEAPON:
			return weapon != null and wm.has_weapon(weapon.id) and not wm.is_weapon_maxed(weapon.id)
		Kind.PASSIVE:
			return passive != null and player.passive_stacks.get(id, 0) < max_stacks
	return false

## Light bias toward the current build so weapons can come together.
func relevance_bonus(player: Player) -> float:
	if kind == Kind.LEVEL_WEAPON and player.weapon_manager.has_weapon(weapon.id):
		return 1.5
	return 1.0

## Luck nudges rarer (higher base_weight tiers) options up a touch.
func rarity_weight(luck: float) -> float:
	return 1.0 + 0.1 * (luck - 1.0)

func apply(player: Player) -> void:
	var wm := player.weapon_manager
	match kind:
		Kind.NEW_WEAPON:
			wm.add_weapon(weapon)
		Kind.LEVEL_WEAPON:
			wm.level_up_weapon(weapon.id)
		Kind.PASSIVE:
			player.stats.apply_passive(passive.axis, passive.magnitude)
			player.passive_stacks[id] = int(player.passive_stacks.get(id, 0)) + 1
			player.refresh_stats()
	EventBus.upgrade_chosen.emit(self)
