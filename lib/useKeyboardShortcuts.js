'use client';
import { useEffect, useCallback } from 'react';

/**
 * Global keyboard shortcuts hook.
 *
 * Usage:
 *   useKeyboardShortcuts({
 *     handlers: {
 *       '1': () => setView('dashboard'),
 *       '2': () => setView('tasks'),
 *       'cmd+k': () => setShowSearch(true),
 *       'n': () => setShowNewProject(true),
 *       'escape': () => closeModal(),
 *     },
 *     enabled: true,
 *   });
 *
 * Automatically ignores shortcuts when typing in inputs/textareas.
 * Supports: 'cmd+k', 'ctrl+k', 'shift+n', 'escape', single keys like '1', 'n'
 */
export function useKeyboardShortcuts({ handlers = {}, enabled = true }) {
  const handleKeyDown = useCallback((e) => {
    if (!enabled) return;

    // Skip when typing in inputs
    const tag = document.activeElement?.tagName?.toLowerCase();
    const isEditable = document.activeElement?.isContentEditable;
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || isEditable) {
      // Only allow Escape in inputs
      if (e.key !== 'Escape') return;
    }

    // Build key combo string
    const parts = [];
    if (e.metaKey || e.ctrlKey) parts.push('cmd');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');

    const key = e.key.toLowerCase();
    if (!['meta', 'control', 'shift', 'alt'].includes(key)) {
      parts.push(key === ' ' ? 'space' : key);
    }

    const combo = parts.join('+');

    // Check for matching handler
    const handler = handlers[combo] || handlers[key] || handlers[e.key];
    if (handler) {
      e.preventDefault();
      e.stopPropagation();
      handler(e);
    }
  }, [handlers, enabled]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Keyboard shortcut cheat sheet data.
 * Used to render the '?' help overlay.
 */
export const SHORTCUT_GROUPS = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['Cmd', '1'], description: 'Dashboard' },
      { keys: ['Cmd', '2'], description: 'My Tasks' },
      { keys: ['Cmd', '3'], description: 'Projects' },
      { keys: ['Cmd', '4'], description: 'Calendar' },
      { keys: ['Cmd', '5'], description: 'Team' },
      { keys: ['Cmd', 'K'], description: 'Global Search' },
      { keys: ['Esc'], description: 'Close modal / Go back' },
    ]
  },
  {
    title: 'Projects',
    shortcuts: [
      { keys: ['N'], description: 'New project' },
      { keys: ['U'], description: 'Upload assets' },
    ]
  },
  {
    title: 'Asset Viewer',
    shortcuts: [
      { keys: ['<'], description: 'Previous asset' },
      { keys: ['>'], description: 'Next asset' },
      { keys: ['1-5'], description: 'Star rating' },
      { keys: ['A'], description: 'Approve' },
      { keys: ['R'], description: 'Request revision' },
      { keys: ['F'], description: 'Fullscreen' },
      { keys: ['Space'], description: 'Play/pause video' },
      { keys: ['C'], description: 'Focus comment' },
      { keys: ['+'], description: 'Zoom in' },
      { keys: ['-'], description: 'Zoom out' },
      { keys: ['0'], description: 'Reset zoom' },
    ]
  },
  {
    title: 'Color Tags',
    shortcuts: [
      { keys: ['Q'], description: 'Red' },
      { keys: ['W'], description: 'Orange' },
      { keys: ['Y'], description: 'Yellow' },
      { keys: ['G'], description: 'Green' },
      { keys: ['B'], description: 'Blue' },
      { keys: ['P'], description: 'Purple' },
    ]
  }
];
