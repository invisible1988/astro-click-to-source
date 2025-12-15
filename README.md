# astro-click-to-source

[![npm version](https://img.shields.io/npm/v/astro-click-to-source.svg)](https://www.npmjs.com/package/astro-click-to-source)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

An Astro integration that enables click-to-source functionality during development. Hold Alt (or another modifier) and click any element to instantly open its source file in your editor at the exact line and column.

## Features

- **Alt+Click to open source** - Jump directly to the component source in your editor
- **Visual highlighting** - See which element you're about to open when holding the modifier key
- **Tooltip preview** - Shows the file path and line number before you click
- **Clipboard mode** - Copy the source path instead of opening the editor
- **Multi-editor support** - Works with VS Code, Neovim, WebStorm, and more
- **HMR-aware** - Maintains source mappings across hot module reloads
- **Zero config** - Works out of the box with sensible defaults

## Installation

```bash
npm install astro-click-to-source
```

## Usage

Add the integration to your `astro.config.mjs`:

```javascript
import { defineConfig } from 'astro/config';
import { clickToSource } from 'astro-click-to-source';

export default defineConfig({
  integrations: [clickToSource()]
});
```

Then run your dev server and **Alt+Click** (or **Option+Click** on Mac) any element to open its source file.

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `modifier` | `'alt' \| 'ctrl' \| 'meta' \| 'shift'` | `'alt'` | Modifier key to hold while clicking |
| `showHighlight` | `boolean` | `true` | Show visual highlight on hover when modifier is held |

### Example with options

```javascript
import { clickToSource } from 'astro-click-to-source';

export default defineConfig({
  integrations: [
    clickToSource({
      modifier: 'ctrl',      // Use Ctrl+Click instead of Alt+Click
      showHighlight: false   // Disable visual highlighting
    })
  ]
});
```

## Environment Variables

### `CLICK_TO_SOURCE`

Set this environment variable to customize the behavior:

| Value | Behavior |
|-------|----------|
| `code` (default) | Open in VS Code |
| `cursor` | Open in Cursor |
| `nvim` | Open in Neovim |
| `vim` | Open in Vim |
| `webstorm` | Open in WebStorm |
| `phpstorm` | Open in PhpStorm |
| `idea` | Open in IntelliJ IDEA |
| `sublime` | Open in Sublime Text |
| `atom` | Open in Atom |
| `clipboard` | Copy path to clipboard instead of opening editor |

```bash
# Open in Neovim
CLICK_TO_SOURCE=nvim npm run dev

# Copy to clipboard
CLICK_TO_SOURCE=clipboard npm run dev
```

## How It Works

1. **Source Mapping**: Astro adds `data-astro-source-file` and `data-astro-source-loc` attributes to elements in development mode
2. **Caching**: The integration caches these mappings to survive HMR updates
3. **Click Handling**: When you Alt+Click, it finds the nearest element with source info
4. **Editor Opening**: Uses [`launch-editor`](https://github.com/yyx990803/launch-editor) to open your editor at the exact location

## Editor Detection

The integration uses `launch-editor` which automatically detects your editor from:

1. `CLICK_TO_SOURCE` environment variable
2. `LAUNCH_EDITOR` environment variable
3. `EDITOR` environment variable
4. Running editor processes

## Requirements

- Astro 4.0.0 or higher
- Node.js 18.17.0 or higher

## License

MIT
