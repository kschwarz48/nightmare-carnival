// Evolution recipes (D-79): the bands on level-up cards and the tray's tooltips read the build of the player
// they're shown to. A level-up a teammate set off (by picking up the ticket) used to be shown against the
// teammate's build, and a guest's next hand could arrive before the snapshot carrying the pick just made.

import { describe, expect, it } from 'vitest';
import { makeGame } from './helpers';
import { WEAPONS, BASE_WEAPON_IDS } from '../src/data/weapons';
import { buildOf, type DraftBuild } from '../src/sim/draft';
import { kitOf, passiveFeeds, recipeState, type Kit } from '../src/ui/recipes';

const kit = (w: [string, number][], p: [string, number][], unlocked: (u?: string) => boolean = () => true): Kit => ({ weapons: new Map(w), passives: new Map(p), unlocked });

describe('evolution recipes (D-79)', () => {
  it('a level-up a teammate sets off still shows each player their own build', () => {
    const g = makeGame({ godMode: true, players: [{ character: 'carny', name: 'Host' }, { character: 'strongman', name: 'Guest' }] });
    const [host, guest] = g.players;
    host.weapons.list.length = 0;
    guest.weapons.list.length = 0;
    const w = host.weapons.add('tarot')!;
    w.level = 8;
    host.addPassive('spectacles');
    guest.weapons.add('mallet');
    const hands: { player?: number; build?: DraftBuild }[] = [];
    let ctxAtDeal = -1;
    g.bus.on('draft', (e) => {
      hands.push(e);
      if (e.player === 0) ctxAtDeal = g.player.index;
    });
    // the guest picks up the ticket that levels the party
    g.setCtx(guest);
    g.addXp(g.xpToNext + 1);
    expect(hands.map((h) => h.player).sort()).toEqual([0, 1]);
    // (the game's context still pointed at the teammate when the host's hand was dealt: the old bug)
    expect(ctxAtDeal).toBe(1);
    const mine = hands.find((h) => h.player === 0)!;
    expect(mine.build).toEqual(buildOf(host));
    const st = recipeState(kitOf(g, host, mine.build), 'tarot')!;
    expect(st).toMatchObject({ owned: true, lv: 8, haveLv: true, mine: true, ready: true });
    // read from the context instead, it would have said the host had neither
    expect(recipeState(kitOf(g, g.player), 'tarot')).toMatchObject({ owned: false, mine: false });
  });

  it("a guest's hand counts the pick it carries, before any snapshot does", () => {
    const g = makeGame({ godMode: true, players: [{ character: 'carny', name: 'Host' }, { character: 'strongman', name: 'Guest' }] });
    const guest = g.players[1];
    guest.weapons.list.length = 0;
    guest.weapons.add('darts')!.level = 8;
    // the mirror hasn't heard of the Spectacles yet; the hand's build has
    const build: DraftBuild = { w: [['darts', 8]], p: [['spectacles', 1]] };
    expect(recipeState(kitOf(g, guest), 'darts')!.ready).toBe(false);
    expect(recipeState(kitOf(g, guest, build), 'darts')!.ready).toBe(true);
    // a malformed build is ignored: the player's own kit is read instead
    expect(recipeState(kitOf(g, guest, { w: 'x', p: [] } as unknown as DraftBuild), 'darts')).toMatchObject({ owned: true, mine: false });
  });

  it('every evolution reads right: owned, its level, its passive, ready only with both', () => {
    for (const id of BASE_WEAPON_IDS) {
      const d = WEAPONS[id];
      if (!d.evolvesTo || !d.evoPassive) continue;
      expect(recipeState(kit([[id, d.maxLevel]], [[d.evoPassive, 1]]), id), id).toMatchObject({ owned: true, haveLv: true, mine: true, ready: true });
      expect(recipeState(kit([[id, 3]], [[d.evoPassive, 2]]), id), id).toMatchObject({ owned: true, lv: 3, haveLv: false, mine: true, ready: false });
      expect(recipeState(kit([[id, d.maxLevel]], []), id), id).toMatchObject({ mine: false, ready: false });
      expect(recipeState(kit([], []), id), id).toMatchObject({ owned: false, lv: 0, ready: false });
      // on an offered card: the level it brings, or the passive it is
      expect(recipeState(kit([[id, 7]], [[d.evoPassive, 1]]), id, 8)!.ready, id).toBe(true);
      expect(recipeState(kit([[id, d.maxLevel]], []), id, undefined, true)!.ready, id).toBe(true);
    }
    expect(recipeState(kit([], []), 'royal_flush')).toBeNull();
  });

  it("a passive's card lists what it can still evolve, held weapons first", () => {
    // the Strongman's Belt feeds the Top Hat, the Ring Toss and the Grill
    const feeds = ['tophat', 'rings', 'grill'].filter((id) => WEAPONS[id].evoPassive === 'strongman_belt');
    expect(feeds.length).toBe(3);
    expect(passiveFeeds(kit([['grill', 2]], []), 'strongman_belt')[0]).toBe('grill');
    // a weapon already evolved needs it no more; one outside the draft pool can't come of it
    const list = passiveFeeds(kit([['saturn_rings', 1]], [], (u) => u !== WEAPONS.tophat.unlock || !u), 'strongman_belt');
    expect(list).not.toContain('rings');
    if (WEAPONS.tophat.unlock) expect(list).not.toContain('tophat');
    expect(list).toContain('grill');
  });
});
