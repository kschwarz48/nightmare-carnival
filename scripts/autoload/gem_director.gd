extends Node
## XP-gem spawning with a Vampire-Survivors-style ground cap + "Red Gem Bank"
## (03 §6). At most CAP gems may sit on the ground at once (an anti-lag rule).
## Past the cap, new XP is vacuumed into a single accumulating bank gem (drawn big
## and red) instead of spawning more — collecting it dumps the whole hoard at once,
## triggering a chain of level-ups. Gem color is keyed to payout (see TicketGem).

const TICKET_SCENE := preload("res://scenes/pickups/ticket_gem.tscn")
const CAP := 400

var _count: int = 0          # gems currently on the ground (the bank counts as one)
var _bank: TicketGem = null

func _ready() -> void:
	EventBus.run_started.connect(func(_c, _d): reset())

func reset() -> void:
	_count = 0
	_bank = null

## Drop `value` XP at `at` (parented under `parent`). Under the cap this spawns a
## normal gem; at/over the cap it feeds the single red bank gem instead.
func drop(value: int, at: Vector2, parent: Node) -> void:
	if _count < CAP:
		_spawn(value, at, parent)
	elif is_instance_valid(_bank):
		_bank.add_to_bank(value)
	else:
		_bank = _spawn(value, at, parent)
		_bank.make_bank()

func _spawn(value: int, at: Vector2, parent: Node) -> TicketGem:
	var gem: TicketGem = ObjectPool.acquire(TICKET_SCENE, parent)
	gem.global_position = at
	gem.set_value(value)
	_count += 1
	return gem

## Called by a gem as it leaves play (collected or pool-released).
func on_gem_freed(gem: TicketGem) -> void:
	_count = maxi(0, _count - 1)
	if gem == _bank:
		_bank = null
