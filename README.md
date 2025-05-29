![image](https://github.com/user-attachments/assets/8782dbd9-36d2-4dd7-a3ea-a10c38651774)

# KeyFit – Keyboard Usage Analytics Desktop App

KeyFit is a privacy-first desktop application that visualizes your real-world typing data, helping you discover your optimal keyboard form factor (45%/60%/75%/TKL, etc.). Designed for programmers, writers, students, and keyboard enthusiasts, KeyFit provides actionable insights into your typing habits—all while keeping your data 100% local.

## Features

- **Background Monitoring**: Auto-starts with OS, accessible from the system tray (Windows) or menu bar (macOS).
- **Comprehensive Key Capture**: Hooks all key events and aggregates usage per day in a local SQLite database.
- **Heatmap Visualization**: Interactive, high-performance (60fps) SVG heatmap with automatic dark/light theme switching.
- **Flexible Filtering**: Filter stats by date range (week/month/all/custom) and by application.
- **App Exclusion**: Easily exclude specific apps from monitoring via UI.
- **Data Management**: Reset, import, or export your entire database with a single click.
- **Auto Update**: Seamless differential updates and version info display.
- **Accessibility**: Color-blind friendly palettes (Color Brewer presets).

## Privacy & Security

- All data is stored locally—nothing is ever sent externally.
- Data is aggregated by hour, making it impossible to reconstruct individual typed strings.
- No encryption is applied, but privacy is ensured by design.
- Windows builds are code-signed; macOS builds are notarized.

## Technology Stack

| Layer      | Technology                                 | Notes                                 |
|------------|--------------------------------------------|---------------------------------------|
| UI         | React + TypeScript + MUI v7                | Built-in theme toggling               |
| Host       | Tauri 2.x (Rust backend + WebView2/WebKit) | Lightweight, native tray integration  |
| Key Hook   | Rust `rdev` library                        | WH_KEYBOARD_LL (Win) / Event Tap (Mac)|
| Database   | SQLite (rusqlite)                          | No encryption                         |
| Visualization | d3/visx + SVG                           | 60fps heatmap rendering               |
| Testing    | Vitest (UI) / Rust unit tests              | Playwright planned for later          |

## Data Model

```text
app (
  id INTEGER PK,
  name TEXT,
  bundle_id TEXT
)

key_stat (
  ts_day   INTEGER  ← Unix epoch (rounded)
  key_code INTEGER
  app_id   INTEGER FK→app.id
  count    INTEGER
  PRIMARY KEY (ts_hour, key_code, app_id)
)

excluded_app (
  app_id INTEGER PK
)
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [Rust](https://www.rust-lang.org/tools/install)
- [Tauri CLI](https://tauri.app/v1/guides/getting-started/prerequisites/)
- [Yarn](https://yarnpkg.com/) or [npm](https://www.npmjs.com/)

### Setup

```bash
# Install dependencies
yarn install
# or
npm install

# Start the development server
yarn tauri dev
# or
npm run tauri dev
```

### Build

```bash
yarn tauri build
# or
npm run tauri build
```

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri Extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## License

MIT
