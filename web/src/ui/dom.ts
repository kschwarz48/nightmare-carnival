// Tiny DOM helpers + spatial focus navigation so every menu is fully controller/keyboard drivable.

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, any> = {}, ...children: (Node | string | null | undefined | false)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') (el as any)[k.toLowerCase()] = v;
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, String(v));
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

/**
 * Spatial focus navigation: elements marked `data-nav` inside the root are focusable; arrows /
 * D-pad move to the nearest element in that direction; confirm clicks it.
 */
export class FocusNav {
  current: HTMLElement | null = null;
  constructor(public root: HTMLElement) {}

  items(): HTMLElement[] {
    return Array.from(this.root.querySelectorAll<HTMLElement>('[data-nav]')).filter((e) => !(e as HTMLButtonElement).disabled && e.offsetParent !== null);
  }

  focus(el: HTMLElement | null): void {
    if (this.current) this.current.classList.remove('focus');
    this.current = el;
    if (el) {
      el.classList.add('focus');
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  ensure(): void {
    if (this.current && this.root.contains(this.current) && this.current.offsetParent !== null) return;
    const items = this.items();
    const pref = items.find((e) => e.dataset.default !== undefined) ?? items[0] ?? null;
    this.focus(pref);
  }

  move(dir: 'up' | 'down' | 'left' | 'right'): boolean {
    const items = this.items();
    if (!items.length) return false;
    if (!this.current || !items.includes(this.current)) {
      this.focus(items[0]);
      return true;
    }
    const a = this.current.getBoundingClientRect();
    const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best: HTMLElement | null = null;
    let bestScore = Infinity;
    for (const el of items) {
      if (el === this.current) continue;
      const b = el.getBoundingClientRect();
      const bx = b.left + b.width / 2, by = b.top + b.height / 2;
      const dx = bx - ax, dy = by - ay;
      let primary = 0, secondary = 0;
      if (dir === 'up') { if (dy >= -2) continue; primary = -dy; secondary = Math.abs(dx); }
      if (dir === 'down') { if (dy <= 2) continue; primary = dy; secondary = Math.abs(dx); }
      if (dir === 'left') { if (dx >= -2) continue; primary = -dx; secondary = Math.abs(dy); }
      if (dir === 'right') { if (dx <= 2) continue; primary = dx; secondary = Math.abs(dy); }
      const score = primary + secondary * 2.2;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    }
    if (best) {
      this.focus(best);
      return true;
    }
    return false;
  }

  activate(): void {
    this.current?.click();
  }
}

export function fmtTime(s: number): string {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

export function fmtNum(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}
