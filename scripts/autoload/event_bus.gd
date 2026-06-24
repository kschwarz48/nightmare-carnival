extends Node
## Global signal hub for cross-system events (07_godot_architecture.md §7).
## Emitters never reference listeners; everyone talks through here.

# --- combat ---
signal enemy_died(enemy: Node, position: Vector2)
signal enemy_spawned(enemy: Node)
signal boss_warning(display_name: String)
signal boss_spawned(boss: Node, boss_data: Resource)
signal boss_defeated(boss: Node, boss_data: Resource)
signal player_damaged(amount: float, current_hp: float)
signal player_died

# --- progression ---
signal ticket_collected(value: int)
signal player_leveled_up(new_level: int)
signal upgrade_chosen(upgrade_data: Resource)
signal weapon_evolved(evolution_data: Resource)

# --- economy / pickups ---
signal gold_collected(value: int)
signal chest_opened(rewards: Variant)

# --- run lifecycle ---
signal run_started(character_data: Resource, difficulty_data: Resource)
signal run_ended(did_win: bool, stats: Dictionary)
signal act_changed(act_index: int)
signal carnival_event_started(event_data: Resource)
signal carnival_event_ended(event_data: Resource)

# --- ui / flow ---
signal request_pause(paused: bool)
signal time_tick(run_seconds: float)

# --- screen navigation (M4; the App root listens and swaps screens, 07 §4) ---
signal goto_menu
signal goto_character_select
signal goto_lost_and_found
signal start_run(character_id: StringName)
signal run_again
