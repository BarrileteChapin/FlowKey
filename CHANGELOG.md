# Changelog

## 0.1.0

- Added interactive Window Launcher command and default shortcut (`Ctrl+Alt+K` / `Cmd+Alt+K`)
- Improved Flow Editor zero-start UX with explicit `New Flow` actions
- Wired Flow Editor settings action to open the FlowKey settings sidebar
- Added on-demand `Load Examples` inside Flow Editor only (removed global quick action/command exposure)
- Enhanced settings panel with shortcut recording controls and launcher shortcut support
- Added long-press (double-press chord) and external device key trigger fields for launcher shortcuts
- Added launcher trigger handler to distinguish normal press vs long-press/repeat behavior
- Added live settings preview in sidebar for immediate feedback without switching panels
- Added explicit `Exit` controls in Flow Editor toolbar and dock to close the editor reliably
- Simplified Flow Editor dock to remove duplicate action buttons and keep a single main action surface
- Reworked shortcut settings around direct feature bindings for HUD, Flow Editor, and Accessibility
- Added command hint buttons in Settings for common external command IDs
- Added built-in gesture figure references in Accessibility so users can discover available shapes quickly
- Added direct figure-to-HUD binding UI in Accessibility (choose profile/tile and bind action)
- Added clearer Accessibility iconography and visible remove-binding actions
- Made Flow Editor settings and clear-flow actions visible in the main toolbar
- Added scrollable command ID surfaces in Flow Editor inspector and node cards for long command names
- Added `Load Examples` action inside Flow Editor toolbar
- Added `test:quick` and `test:full` scripts to speed local testing loops
- Improved packaging setup: codicons runtime dependency, files allowlist, and non-interactive package script
