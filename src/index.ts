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

import type { AstroIntegration } from "astro";
import { getClientScript } from "./client.js";
import type { ActionType, ClickToSourceOptions, ModifierKey } from "./types.js";
import { clickToSourceVitePlugin } from "./vite-plugin.js";

// Re-export types for consumers
export type { ClickToSourceOptions, ModifierKey, ActionType };

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

        // Add the Vite plugin that handles the /__open-in-editor endpoint
        updateConfig({
          vite: {
            plugins: [clickToSourceVitePlugin({ editor: target })],
          },
        });

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
