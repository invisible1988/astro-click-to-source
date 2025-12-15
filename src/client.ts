/**
 * Generates the client-side script for click-to-source functionality.
 * Handles modifier+click to open source files in the editor or copy path.
 */
import type { ClientScriptOptions } from "./types.js";

/**
 * Generates the client-side JavaScript as a string
 */
export function getClientScript(
  options: Partial<ClientScriptOptions> = {},
): string {
  const modifier = options.modifier || "alt";
  const showHighlight = options.showHighlight !== false;
  const action = options.action || "editor";

  return `
(function() {
  // Helper to get element path for cache lookup
  function getElementPath(el) {
    const parts = [];
    let current = el;
    while (current && current !== document.documentElement) {
      let selector = current.tagName.toLowerCase();
      if (current.id) {
        selector += '#' + current.id;
      } else if (current.className && typeof current.className === 'string') {
        const classes = current.className.split(' ').filter(c => c && !c.startsWith('click-to-source')).slice(0, 2);
        if (classes.length) selector += '.' + classes.join('.');
      }
      parts.unshift(selector);
      current = current.parentElement;
    }
    return parts.join(' > ');
  }

  // Cache source mappings from Astro's attributes (before HMR strips them)
  function cacheSourceMappings() {
    if (!window.__sourceMapCache) {
      window.__sourceMapCache = new WeakMap();
      window.__sourceMapByPath = new Map();
    }

    document.querySelectorAll('[data-astro-source-file]').forEach(el => {
      if (!window.__sourceMapCache.has(el)) {
        const file = el.getAttribute('data-astro-source-file');
        const loc = el.getAttribute('data-astro-source-loc');
        window.__sourceMapCache.set(el, { file, loc });

        const path = getElementPath(el);
        window.__sourceMapByPath.set(path, { file, loc, tagName: el.tagName });
      }
    });
  }

  // Initial cache population
  cacheSourceMappings();

  // Clean up previous instance on HMR
  if (window.__clickToSourceCleanup) {
    window.__clickToSourceCleanup();
  }

  const MODIFIER = '${modifier}';
  const SHOW_HIGHLIGHT = ${showHighlight};
  const ACTION = '${action}';

  const modifierKeyMap = {
    alt: 'altKey',
    ctrl: 'ctrlKey',
    meta: 'metaKey',
    shift: 'shiftKey'
  };
  const modifierKey = modifierKeyMap[MODIFIER];

  let isModifierHeld = false;
  let highlightedElement = null;
  let lastMouseTarget = null;
  let styleElement = null;
  let tooltipElement = null;
  let tooltipFileSpan = null;
  let tooltipLocSpan = null;

  // Inject styles
  if (SHOW_HIGHLIGHT) {
    styleElement = document.createElement('style');
    styleElement.id = 'click-to-source-styles';
    styleElement.textContent = \`
      .click-to-source-highlight {
        background-color: rgba(59, 130, 246, 0.12) !important;
        outline: 2px solid rgba(59, 130, 246, 0.7) !important;
        outline-offset: 1px;
        cursor: pointer !important;
        transition: background-color 0.15s ease, outline-color 0.15s ease;
      }
      .click-to-source-active {
        cursor: pointer !important;
      }
      .click-to-source-tooltip {
        position: fixed;
        z-index: 999999;
        padding: 4px 8px;
        background: rgba(0, 0, 0, 0.85);
        color: #fff;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 11px;
        border-radius: 4px;
        pointer-events: none;
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        opacity: 0;
        transition: opacity 0.15s ease;
      }
      .click-to-source-tooltip.visible {
        opacity: 1;
      }
      .click-to-source-tooltip-file {
        color: #93c5fd;
      }
      .click-to-source-tooltip-loc {
        color: #86efac;
        margin-left: 6px;
      }
    \`;
    const oldStyle = document.getElementById('click-to-source-styles');
    if (oldStyle) oldStyle.remove();
    document.head.appendChild(styleElement);

    // Create tooltip element using safe DOM methods
    tooltipElement = document.createElement('div');
    tooltipElement.className = 'click-to-source-tooltip';

    tooltipFileSpan = document.createElement('span');
    tooltipFileSpan.className = 'click-to-source-tooltip-file';

    tooltipLocSpan = document.createElement('span');
    tooltipLocSpan.className = 'click-to-source-tooltip-loc';

    tooltipElement.appendChild(tooltipFileSpan);
    tooltipElement.appendChild(tooltipLocSpan);
    document.body.appendChild(tooltipElement);
  }

  // Find nearest element with source info
  function findSourceElement(element) {
    let current = element;
    while (current && current !== document.documentElement) {
      // Check WeakMap cache first
      const cached = window.__sourceMapCache?.get(current);
      if (cached) {
        return { element: current, file: cached.file, loc: cached.loc };
      }

      // Check live attributes
      if (current.hasAttribute?.('data-astro-source-file')) {
        return {
          element: current,
          file: current.getAttribute('data-astro-source-file'),
          loc: current.getAttribute('data-astro-source-loc')
        };
      }

      // Try path-based lookup
      const path = getElementPath(current);
      const pathCached = window.__sourceMapByPath?.get(path);
      if (pathCached && pathCached.tagName === current.tagName) {
        return { element: current, file: pathCached.file, loc: pathCached.loc };
      }

      current = current.parentElement;
    }
    return null;
  }

  function removeHighlight() {
    if (highlightedElement) {
      highlightedElement.classList.remove('click-to-source-highlight');
      highlightedElement = null;
    }
    if (tooltipElement) {
      tooltipElement.classList.remove('visible');
    }
  }

  function updateTooltip(x, y, file, loc) {
    if (!tooltipElement || !tooltipFileSpan || !tooltipLocSpan) return;

    // Get relative path (from src/)
    const srcIndex = file.indexOf('/src/');
    const displayPath = srcIndex !== -1 ? file.slice(srcIndex + 1) : file.split('/').slice(-3).join('/');

    // Use textContent for safe text insertion
    tooltipFileSpan.textContent = displayPath;
    tooltipLocSpan.textContent = loc ? ':' + loc : '';

    // Position tooltip near cursor
    const rect = tooltipElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = x + 12;
    let top = y + 12;

    // Keep tooltip in viewport
    if (left + rect.width > viewportWidth - 10) {
      left = x - rect.width - 12;
    }
    if (top + rect.height > viewportHeight - 10) {
      top = y - rect.height - 12;
    }

    tooltipElement.style.left = left + 'px';
    tooltipElement.style.top = top + 'px';
    tooltipElement.classList.add('visible');
  }

  function updateHighlight(target, mouseX, mouseY) {
    if (!SHOW_HIGHLIGHT) return;

    const result = findSourceElement(target);
    if (result && result.element !== highlightedElement) {
      removeHighlight();
      highlightedElement = result.element;
      result.element.classList.add('click-to-source-highlight');
      updateTooltip(mouseX, mouseY, result.file, result.loc);
    } else if (result && result.element === highlightedElement) {
      // Same element, just update tooltip position
      updateTooltip(mouseX, mouseY, result.file, result.loc);
    } else if (!result && highlightedElement) {
      removeHighlight();
    }
  }

  async function openInEditor(file, loc) {
    const params = new URLSearchParams({ file });
    if (loc) {
      const [line, column] = loc.split(':');
      if (line) params.set('line', line);
      if (column) params.set('column', column);
    }

    try {
      await fetch('/__open-in-editor?' + params.toString());
    } catch (err) {
      console.error('[click-to-source] Failed to open editor:', err);
    }
  }

  // Event handlers
  function handleKeydown(e) {
    if (e[modifierKey] && !isModifierHeld) {
      isModifierHeld = true;
      if (SHOW_HIGHLIGHT) {
        document.body.classList.add('click-to-source-active');
        if (lastMouseTarget) {
          updateHighlight(lastMouseTarget.target, lastMouseTarget.x, lastMouseTarget.y);
        }
      }
    }
  }

  function handleKeyup(e) {
    if (!e[modifierKey] && isModifierHeld) {
      isModifierHeld = false;
      document.body.classList.remove('click-to-source-active');
      removeHighlight();
    }
  }

  function handleBlur() {
    isModifierHeld = false;
    lastMouseTarget = null;
    document.body.classList.remove('click-to-source-active');
    removeHighlight();
  }

  function handleMousemove(e) {
    lastMouseTarget = { target: e.target, x: e.clientX, y: e.clientY };
    if (isModifierHeld) {
      updateHighlight(e.target, e.clientX, e.clientY);
    }
  }

  function handleClick(e) {
    if (!e[modifierKey]) return;

    const result = findSourceElement(e.target);
    if (result) {
      e.preventDefault();
      e.stopPropagation();

      if (ACTION === 'clipboard') {
        copyToClipboard(result.file, result.loc);
      } else {
        openInEditor(result.file, result.loc);
      }
    }
  }

  async function copyToClipboard(file, loc) {
    // Get relative path from src/ (e.g., src/components/foo/Bar.astro:10:5)
    const srcIndex = file.indexOf('/src/');
    const relativePath = srcIndex !== -1 ? file.slice(srcIndex + 1) : file.split('/').slice(-3).join('/');

    let text = relativePath;
    if (loc) {
      text += ':' + loc;
    }

    try {
      await navigator.clipboard.writeText(text);
      showCopyFeedback(text);
    } catch (err) {
      console.error('[click-to-source] Failed to copy:', err);
    }
  }

  function showCopyFeedback(text) {
    // Brief visual feedback that copy succeeded
    const feedback = document.createElement('div');
    feedback.style.cssText = \`
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 8px 16px;
      background: rgba(0, 0, 0, 0.85);
      color: #86efac;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      border-radius: 6px;
      z-index: 999999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: click-to-source-fade 2s ease forwards;
    \`;
    feedback.textContent = 'Copied: ' + text;
    document.body.appendChild(feedback);

    // Add animation keyframes if not already added
    if (!document.getElementById('click-to-source-copy-animation')) {
      const animStyle = document.createElement('style');
      animStyle.id = 'click-to-source-copy-animation';
      animStyle.textContent = \`
        @keyframes click-to-source-fade {
          0%, 70% { opacity: 1; }
          100% { opacity: 0; }
        }
      \`;
      document.head.appendChild(animStyle);
    }

    setTimeout(() => feedback.remove(), 2000);
  }

  // Register event listeners
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('keyup', handleKeyup);
  window.addEventListener('blur', handleBlur);
  document.addEventListener('mousemove', handleMousemove, { passive: true });
  document.addEventListener('click', handleClick, true);

  // Listen for HMR updates to cache new elements
  if (import.meta.hot) {
    import.meta.hot.on('vite:afterUpdate', () => {
      cacheSourceMappings();
    });
  }

  // Cleanup function for HMR
  window.__clickToSourceCleanup = function() {
    document.removeEventListener('keydown', handleKeydown);
    document.removeEventListener('keyup', handleKeyup);
    window.removeEventListener('blur', handleBlur);
    document.removeEventListener('mousemove', handleMousemove);
    document.removeEventListener('click', handleClick, true);
    document.body.classList.remove('click-to-source-active');
    removeHighlight();
    if (styleElement) styleElement.remove();
    if (tooltipElement) tooltipElement.remove();
  };
})();
`;
}
