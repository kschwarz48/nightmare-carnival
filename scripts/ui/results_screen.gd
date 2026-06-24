extends Control
## Run results / payout (01 §8, 11). Shows the tally and credits the run's Lost
## Tickets to the SaveManager exactly once, then offers a one-click Run Again.

@onready var banner: Label = %Banner
@onready var stats_label: Label = %Stats
@onready var payout_label: Label = %Payout
@onready var run_again_btn: Button = %RunAgain
@onready var lf_btn: Button = %LostAndFound
@onready var menu_btn: Button = %Menu

var _stats: Dictionary = {}
var _credited: bool = false

## Called by App before this screen enters the tree.
func setup(stats: Dictionary) -> void:
	_stats = stats

func _ready() -> void:
	var won: bool = _stats.get("won", false)
	banner.text = "DAWN!" if won else "GAME OVER"
	var t: int = int(_stats.get("time", 0.0))
	stats_label.text = "Time  %d:%02d      Kills  %d      Bosses  %d" % [
		t / 60, t % 60, int(_stats.get("kills", 0)), int(_stats.get("bosses", 0))]
	var earned: int = int(_stats.get("lost_tickets", 0))
	if not _credited:
		_credited = true
		SaveManager.add_lost_tickets(earned)
	payout_label.text = "Lost Tickets earned: %d    (total: %d)" % [earned, SaveManager.lost_tickets()]
	run_again_btn.pressed.connect(func(): EventBus.run_again.emit())
	lf_btn.pressed.connect(func(): EventBus.goto_lost_and_found.emit())
	menu_btn.pressed.connect(func(): EventBus.goto_menu.emit())
	run_again_btn.grab_focus()
