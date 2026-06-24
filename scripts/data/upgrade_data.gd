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
# Optional meta gate (Lost & Found unlock, 01 §9): if set and not unlocked, this
# option never appears in the draft.
@export var unlock_id: StringName = &""
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
	if unlock_id != &"" and not SaveManager.is_unlocked(unlock_id):
		return false                    # gated behind a Lost & Found unlock
	var wm := player.weapon_manager
	match kind:
		Kind.NEW_WEAPON:
			if weapon == null or wm.has_weapon(weapon.id) or not wm.has_room():
				return false
			# Don't re-offer a base weapon once its evolution is already owned (06 §5).
			var evo := weapon.evolution as EvolutionData
			if evo != null and evo.result != null and wm.has_weapon(evo.result.id):
				return false
			return true
		Kind.LEVEL_WEAPON:
			return weapon != null and wm.has_weapon(weapon.id) and not wm.is_weapon_maxed(weapon.id)
		Kind.PASSIVE:
			if passive == null or player.passive_stacks.get(id, 0) >= max_stacks:
				return false
			# Distinct-passive cap: a brand-new passive is illegal once full (06 §1).
			if not player.owned_passives.has(passive.id) \
					and player.owned_passives.size() >= Player.MAX_PASSIVES:
				return false
			return true
		Kind.EVOLUTION:
			# Pre-validated by EvolutionSystem; offered directly, not sampled from
			# the pool. Re-check the base is still owned and unevolved.
			return weapon != null and evolved_weapon != null \
				and player.weapon_manager.has_weapon(weapon.id)
	return false

## Bias toward the current build so weapons come together — and especially toward
## *completing* an evolution the player is clearly pursuing (06 §4 pity/relevance).
func relevance_bonus(player: Player) -> float:
	var wm := player.weapon_manager
	match kind:
		Kind.LEVEL_WEAPON:
			if weapon == null or not wm.has_weapon(weapon.id):
				return 1.0
			# If this weapon's evolution is gated only by more levels (its passive
			# is already owned), push hard so the build can finish.
			if weapon.evolution != null and weapon.required_passive != &"" \
					and int(player.passive_levels.get(weapon.required_passive, 0)) >= 1:
				return 3.0
			return 1.5
		Kind.PASSIVE:
			# If an owned weapon's evolution still needs this passive, push it up.
			if passive != null and int(player.passive_levels.get(passive.id, 0)) < 1:
				for wid in wm.weapons:
					var wd: WeaponData = (wm.weapons[wid] as Weapon).data
					if wd.evolution != null and wd.required_passive == passive.id:
						return 2.5
			return 1.0
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
			player.owned_passives[passive.id] = passive
			player.refresh_stats()
		Kind.EVOLUTION:
			wm.evolve_weapon(weapon.id, evolved_weapon)
	EventBus.upgrade_chosen.emit(self)
