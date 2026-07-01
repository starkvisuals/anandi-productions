// lib/z.js — single z-index scale for every layered surface.
//
// Before this file, the app had 13 different modal implementations with
// random z-indexes (1000, 1100, 1200, 2100, 2200). Any component that
// stacks MUST use one of these constants — no raw numbers.

export const Z = {
  base:      1,       // ordinary in-flow content
  raised:    10,      // sticky bars, hover cards
  dropdown:  100,     // <select> menus, autocomplete popovers
  sidebar:   500,     // fixed nav / drawer
  header:    700,     // sticky app header
  overlay:   1000,    // page overlays (mobile nav backdrop)
  modal:     1100,    // dialogs, sheets — the standard
  popover:   1200,    // popovers ABOVE modals (date pickers inside modals, etc.)
  toast:     1300,    // system notifications
  tooltip:   1400,    // must beat everything
  dev:       9999,    // dev-only overlays (component preview, etc.)
};

export default Z;
