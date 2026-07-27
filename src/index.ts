/**
 * Astro integration for click-to-source functionality.
 * Enables Alt+Click (Option+Click on Mac) to jump directly to source files in the editor.
 *
 * @example
 * // astro.config.mjs
 * import { clickToSource } from 'astro-click-to-source';
 *
 * export default defineConfig({
 *   integrations: [clickToSource()]
 * });
 */

import { createRequire } from "node:module";
import type { AstroIntegration } from "astro";
import { clickToSourceAnnotatePlugin } from "./annotate-plugin.js";
import { getClientScript } from "./client.js";
import type { ActionType, ClickToSourceOptions, ModifierKey } from "./types.js";
import { clickToSourceVitePlugin } from "./vite-plugin.js";

// Re-export types for consumers
export type { ActionType, ClickToSourceOptions, ModifierKey };

/**
 * Reads the installed Astro major version, or `null` if it can't be resolved.
 * Used to decide whether we need to re-inject source annotations ourselves.
 */
function getAstroMajor(): number | null {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require("astro/package.json") as { version: string };
    return Number.parseInt(pkg.version.split(".")[0], 10);
  } catch {
    return null;
  }
}

/**
 * Creates an Astro integration for click-to-source functionality.
 * Only active in development mode.
 *
 * Configure via CLICK_TO_SOURCE env var:
 * - 'clipboard' = copy path to clipboard
 * - 'code', 'nvim', 'webstorm', etc. = open in that editor
 * - Not set = defaults to 'code' (VS Code)
 *
 * @param options - Configuration options
 * @returns Astro integration
 */
export function clickToSource(
  options: ClickToSourceOptions = {},
): AstroIntegration {
  const { modifier = "alt", showHighlight = true } = options;

  // Read env var - 'clipboard' or editor name
  const target = process.env.CLICK_TO_SOURCE || "code";
  const isClipboard = target === "clipboard";

  // Astro 7's Rust compiler stopped emitting `data-astro-source-*` attributes,
  // which click-to-source depends on. On Astro 7+ we inject them ourselves.
  // `options.annotate` forces this on/off; otherwise we auto-detect.
  const astroMajor = getAstroMajor();
  const annotate = options.annotate ?? (astroMajor !== null && astroMajor >= 7);

  return {
    name: "astro-click-to-source",
    hooks: {
      "astro:config:setup": ({
        command,
        updateConfig,
        injectScript,
        logger,
      }) => {
        // Only enable in development mode
        if (command !== "dev") {
          return;
        }

        if (isClipboard) {
          logger.info("Click-to-source enabled (Alt+Click to copy path)");
        } else {
          logger.info(
            `Click-to-source enabled (Alt+Click to open in ${target})`,
          );
        }

        // Add the Vite plugin that handles the /__open-in-editor endpoint,
        // plus (on Astro 7+) the plugin that restores source annotations.
        const plugins = [clickToSourceVitePlugin({ editor: target })];
        if (annotate) {
          logger.info(
            "Injecting source annotations (Astro 7+ compiler no longer provides them)",
          );
          plugins.push(clickToSourceAnnotatePlugin());
        }

        // The cast is a workaround for a TypeScript 6.0.2+ crash when checking
        // this call against Astro's deep config type over Vite's recursive
        // plugin type; it does not change runtime behavior.
        updateConfig({
          vite: { plugins },
        } as Parameters<typeof updateConfig>[0]);

        // Inject the client-side script
        injectScript(
          "page",
          getClientScript({
            modifier,
            showHighlight,
            action: isClipboard ? "clipboard" : "editor",
          }),
        );
      },
    },
  };
}

// Default export for convenience
export default clickToSource;
