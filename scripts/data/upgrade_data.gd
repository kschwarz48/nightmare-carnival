class_name UpgradeData
extends Resource
## A single draftable option (06 §4, 08 §9). Wraps a new weapon, a weapon
## level-up, or a passive (stacking). The draft generator filters by is_legal()
## and applies the choice via apply().

enum Kind { NEW_WEAPON, LEVEL_WEAPON, PASSIVE, EVOLUTION }

@export var id: StringName = &""
@export var display_name: String = ""
@export var description: String = ""
@export var kind: Kind = Kind.PASSIVE
@export var base_weight: float = 1.0

# NEW_WEAPON / LEVEL_WEAPON / EVOLUTION (base weapon being evolved)
@export var weapon: WeaponData
# PASSIVE
@export var passive: PassiveData
@export var max_stacks: int = 5
# EVOLUTION — set at runtime by EvolutionSystem.make_evolution(), not authored.
@export var evolved_weapon: WeaponData

## Build a runtime EVOLUTION card (08 §9.2). Not loaded from disk — the draft
## generator creates these on the fly when prerequisites are met.
static func make_evolution(base: WeaponData, evo: EvolutionData) -> UpgradeData:
	var up := UpgradeData.new()
	up.id = StringName("evo_" + String(base.id))
	up.kind = Kind.EVOLUTION
	up.base_weight = 1.0
	up.weapon = base
	up.evolved_weapon = evo.result
	up.display_name = evo.display_name
	up.description = evo.description
	return up

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
		Kind.EVOLUTION:
			# Pre-validated by EvolutionSystem; offered directly, not sampled from
			# the pool. Re-check the base is still owned and unevolved.
			return weapon != null and evolved_weapon != null \
				and player.weapon_manager.has_weapon(weapon.id)
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
			if passive.axis2 != &"":
				player.stats.apply_passive(passive.axis2, passive.magnitude2)
			player.passive_stacks[id] = int(player.passive_stacks.get(id, 0)) + 1
			# Track by passive identity too, so EvolutionSystem can check ownership
			# (keyed by PassiveData.id, independent of which wrapper granted it).
			player.passive_levels[passive.id] = int(player.passive_levels.get(passive.id, 0)) + 1
			player.refresh_stats()
		Kind.EVOLUTION:
			wm.evolve_weapon(weapon.id, evolved_weapon)
	EventBus.upgrade_chosen.emit(self)
