/**
 * Vite plugin that adds a dev server endpoint for opening files in the editor.
 * Handles requests to /__open-in-editor?file=...&line=...&column=...
 */

import launch from "launch-editor";
import type { Plugin } from "vite";
import type { VitePluginOptions } from "./types.js";

/**
 * Creates a Vite plugin that handles the /__open-in-editor endpoint
 */
export function clickToSourceVitePlugin(
  options: VitePluginOptions = {},
): Plugin {
  return {
    name: "vite-plugin-click-to-source",

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || "";

        // Only handle our specific endpoint
        if (!url.startsWith("/__open-in-editor")) {
          return next();
        }

        // Parse query parameters
        const urlObj = new URL(url, "http://localhost");
        const file = urlObj.searchParams.get("file");
        const line = urlObj.searchParams.get("line");
        const column = urlObj.searchParams.get("column");

        if (!file) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Missing file parameter" }));
          return;
        }

        // Build the file:line:column format for launch-editor
        let fileSpec = file;
        if (line) {
          fileSpec += `:${line}`;
          if (column) {
            fileSpec += `:${column}`;
          }
        }

        // Use launch-editor to open the file
        // It will use LAUNCH_EDITOR or EDITOR env vars, or auto-detect
        launch(fileSpec, options.editor, (fileName, errorMessage) => {
          if (errorMessage) {
            console.error(
              `[click-to-source] Failed to open ${fileName}:`,
              errorMessage,
            );
          }
        });

        // Respond immediately - don't wait for editor to open
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.end(JSON.stringify({ success: true, file: fileSpec }));
      });
    },
  };
}
