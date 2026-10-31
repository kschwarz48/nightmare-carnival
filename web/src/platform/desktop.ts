// The Windows app's bridge (web/desktop/preload.js), present only when the game runs inside it. The game
// code stays the same in both places: everything desktop-specific goes through this one object.

/** What the game is doing, as the update system and the desktop shell see it. */
export type SessionState = 'boot' | 'menu' | 'hub' | 'lobby' | 'connecting' | 'loading' | 'match' | 'reconnecting' | 'results';

export interface ShellUpdate {
  version: string;
  ready: boolean;
}

export interface DesktopBridge {
  platform: string;
  shellVersion: string;
  info(): Promise<{ shellVersion: string; electron: string; chrome: string; gameUrl: string; packaged: boolean; shellUpdate: ShellUpdate | null } | null>;
  /** whether a restart now would interrupt anything (the shell refuses to install updates otherwise) */
  setSession(state: SessionState, safe: boolean): void;
  /** load the latest hosted build, bypassing the cache */
  reloadLatest(): Promise<boolean>;
  setFullscreen(on: boolean): Promise<boolean>;
  isFullscreen(): Promise<boolean>;
  onShellUpdate(cb: (u: ShellUpdate) => void): () => void;
  installShellUpdate(): Promise<{ ok: boolean; reason?: string }>;
  quit(): void;
}

export const desktop: DesktopBridge | null = typeof window !== 'undefined' ? ((window as unknown as { ncDesktop?: DesktopBridge }).ncDesktop ?? null) : null;
