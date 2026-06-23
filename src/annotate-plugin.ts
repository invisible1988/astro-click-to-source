/**
 * Vite plugin that re-implements Astro's dev-time source annotation.
 *
 * Astro 7 replaced the Go/WASM compiler (`@astrojs/compiler`) with the Rust
 * compiler (`@astrojs/compiler-rs`). The Rust compiler accepts the
 * `annotateSourceFile` option but does not yet emit the
 * `data-astro-source-file` / `data-astro-source-loc` attributes that
 * click-to-source relies on, so the feature silently stops working.
 *
 * This plugin restores those attributes itself. It runs as a `pre` `load` hook
 * in dev: it reads each bare `.astro` file, parses it with the standalone
 * `@astrojs/compiler` (whose stable, element-based AST gives us exact source
 * positions), and injects the attributes into every element's opening tag.
 * Astro's own plugin then compiles the annotated source we return. We load
 * (rather than transform) because Astro's `.astro` transform is also a `pre`
 * hook that compiles the file to JS — by the time a `transform` of ours could
 * run, the template is already gone. The hook is a no-op (returns `null`) on
 * anything it can't confidently handle, so it can never break a build.
 */

import { readFile } from "node:fs/promises";
import type { ParseResult } from "@astrojs/compiler";
import { parse } from "@astrojs/compiler";
import type { Plugin } from "vite";

// The `@astrojs/compiler` AST node types aren't re-exported from the package
// root, so derive the node union from the one type that is (`ParseResult`).
type AstroNode = ParseResult["ast"]["children"][number];

/**
 * Tags we never annotate: structural/head elements that aren't clickable in
 * the page, plus `script`/`style`, which Astro processes specially and where
 * an extra attribute could interfere with its pipeline.
 */
const SKIP_TAGS = new Set([
  "html",
  "head",
  "base",
  "meta",
  "link",
  "title",
  "style",
  "script",
  "slot",
]);

/**
 * Creates the Vite plugin that injects `data-astro-source-*` attributes into
 * `.astro` templates during development.
 */
export function clickToSourceAnnotatePlugin(): Plugin {
  return {
    name: "vite-plugin-click-to-source-annotate",
    // Run before Astro's own `.astro` compiler hooks.
    enforce: "pre",
    // Dev only — production builds strip source attributes anyway.
    apply: "serve",

    async load(id) {
      const [filePath, query] = id.split("?");

      // Only the bare `.astro` module. Sub-requests like
      // `file.astro?astro&type=script` are extracted from the source we
      // return here, so we must not touch them.
      if (query || !filePath.endsWith(".astro")) {
        return null;
      }

      let code: string;
      try {
        code = await readFile(filePath, "utf8");
      } catch {
        // Not a readable file (virtual module, etc.) — let others handle it.
        return null;
      }

      let ast: AstroNode;
      try {
        ({ ast } = await parse(code, { position: true }));
      } catch {
        // Never break the build over annotation; fall back to raw source.
        return { code, map: null };
      }

      // Escape quotes so a path containing `"` can't break out of the
      // attribute value.
      const fileAttr = filePath.replace(/"/g, "&quot;");
      const inserts: { offset: number; text: string }[] = [];

      const visit = (node: AstroNode): void => {
        if (
          (node.type === "element" || node.type === "custom-element") &&
          !SKIP_TAGS.has(node.name) &&
          node.position?.start &&
          !node.attributes.some((a) => a.name === "data-astro-source-file")
        ) {
          const { line, column, offset } = node.position.start;
          // `offset` points at the opening `<`; insert right after the tag
          // name so existing attributes are preserved.
          inserts.push({
            offset: offset + 1 + node.name.length,
            text: ` data-astro-source-file="${fileAttr}" data-astro-source-loc="${line}:${column}"`,
          });
        }

        if ("children" in node) {
          for (const child of node.children) {
            visit(child);
          }
        }
      };
      visit(ast);

      if (inserts.length === 0) {
        return { code, map: null };
      }

      // Splice in byte space: `@astrojs/compiler` reports 0-based byte
      // offsets, so working on a Buffer keeps multibyte source correct.
      const bytes = Buffer.from(code, "utf8");
      const chunks: Buffer[] = [];
      let cursor = 0;
      inserts.sort((a, b) => a.offset - b.offset);
      for (const ins of inserts) {
        chunks.push(bytes.subarray(cursor, ins.offset));
        chunks.push(Buffer.from(ins.text, "utf8"));
        cursor = ins.offset;
      }
      chunks.push(bytes.subarray(cursor));

      // We only insert attributes (no newlines), so existing line mappings
      // stay valid and a source map isn't needed for the change.
      return { code: Buffer.concat(chunks).toString("utf8"), map: null };
    },
  };
}
