/**
 * Type definitions for astro-click-to-source
 */

/** Modifier key to hold while clicking */
export type ModifierKey = "alt" | "ctrl" | "meta" | "shift";

/** Action to perform on click */
export type ActionType = "editor" | "clipboard";

/**
 * Options for the clickToSource integration
 */
export interface ClickToSourceOptions {
  /**
   * Modifier key to hold while clicking
   * @default 'alt'
   */
  modifier?: ModifierKey;

  /**
   * Show visual highlight on elements when modifier is held
   * @default true
   */
  showHighlight?: boolean;
}

/**
 * Internal options passed to the client script generator
 */
export interface ClientScriptOptions {
  modifier: ModifierKey;
  showHighlight: boolean;
  action: ActionType;
}

/**
 * Options for the Vite plugin
 */
export interface VitePluginOptions {
  /** Editor command to use (e.g., 'code', 'nvim', 'webstorm') */
  editor?: string;
}
