# FlowKey

FlowKey is a VS Code extension that combines a configurable HUD, a visual flow editor, and accessibility-first gesture and voice triggers.

## What It Includes

- HUD tile grid for one-click actions
- Flow editor for building multi-step automations
- Accessibility panel for gesture and voice aliases
- Example flows loaded only from inside the Flow Editor toolbar

## Accessibility Bindings

- Select an available gesture figure
- Choose HUD profile + tile in Accessibility panel
- Bind figure to execute that HUD tile action (command/flow/terminal)

## Core Commands

- `FlowKey: Open Window Launcher`
- `FlowKey: Toggle HUD`
- `FlowKey: Open Flow Editor`
- `FlowKey: Open Accessibility Panel`
- `FlowKey: Open Settings`

## Default Shortcuts

- Windows/Linux: `Ctrl+Alt+K`
- macOS: `Cmd+Alt+K`

FlowKey also supports direct feature shortcuts for:

- Toggle HUD
- Open Flow Editor
- Open Accessibility

Each feature can have a primary shortcut, a double-press trigger, and an external device key.

## Settings Highlights

- Quick press shortcut
- Long press (detected from repeated press while holding, with optional explicit double-press chord)
- External device key (for macro pads/media keys that emit `F13+` or media key codes)
- Live HUD preview for grid, density, tile shape, dock position, and transparency
- Command Access hints for common VS Code command IDs such as rename, quick open, save file, and git pull

## Development

```bash
npm install
npm run build
```

## Testing

```bash
npm run test:quick
npm run test:full

# individual suites
npm run test:unit
npm run test:webview
```

## License

Apache-2.0. See [LICENSE](LICENSE).
