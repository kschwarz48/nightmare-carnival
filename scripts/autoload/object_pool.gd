extends Node
## Reuse instances instead of instantiate()/queue_free() churn
## (08_core_systems_implementation.md §15). Pooled scenes optionally
## implement _on_acquired() / _on_released().
## CONTRACT: never queue_free() a pooled node — always ObjectPool.release().

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
	node.set_meta(&"_pooled", false)
	parent.add_child(node)
	if node.has_method(&"_on_acquired"):
		node.call(&"_on_acquired")
	return node

## Return a node to its pool. Idempotent — safe to call (or call_deferred) more
## than once. NOTE: when releasing from inside a physics collision callback
## (area_entered/body_entered), call this DEFERRED (ObjectPool.call_deferred(
## "release", node)) — remove_child during a query flush is illegal in Godot.
func release(node: Node) -> void:
	if not is_instance_valid(node) or node.get_meta(&"_pooled", false):
		return
	node.set_meta(&"_pooled", true)
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

## Pre-warm a pool to avoid first-spawn hitches.
func prewarm(scene: PackedScene, count: int) -> void:
	var key := scene.resource_path
	if not _pools.has(key):
		_pools[key] = []
	for _i in count:
		var n := scene.instantiate()
		n.set_meta(&"_pool_key", key)
		if n.has_method(&"_on_released"):
			n.call(&"_on_released")
		_pools[key].append(n)
