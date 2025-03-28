# vite-plugin-ssr-hot-reload

A Vite plugin that forces a full page reload when your SSR entry file changes. It also injects `@vite/client` into the HTML response so hot reload can work properly.

## Install

```bash
npm install -D vite-plugin-ssr-hot-reload
```

## Usage

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import ssrHotReload from 'vite-plugin-ssr-hot-reload'

export default defineConfig({
  plugins: [ssrHotReload()]
})
```

## Options

### entry

You can pass `entry` to specify which files should trigger a full reload.

```ts
ssrHotReload({
  entry: ['/src/pages/**/*.tsx', '/src/layouts/**/*.ts']
})
```

By default, the plugin watches:

```ts
entry: ['/src/**/*.ts', '/src/**/*.tsx']
```

### ignore

You can pass `ignore` to specify which files should be excluded from triggering a full reload, even if they match the entry patterns.

```ts
ssrHotReload({
  entry: ['/src/pages/**/*.tsx'],
  ignore: ['/src/pages/ignored/**/*.tsx']
})
```

### injectReactRefresh

You can pass `injectReactRefresh: true` to inject React Refresh scripts into the HTML head. This is useful for React applications that need hot module replacement for React components.

**Note:** To use this feature, you need to install `@vitejs/plugin-react` in your project.

```ts
// First, install @vitejs/plugin-react
// npm install -D @vitejs/plugin-react

// Then in your vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import ssrHotReload from 'vite-plugin-ssr-hot-reload'

export default defineConfig({
  plugins: [
    react(), // Make sure to include the React plugin
    ssrHotReload({
      injectReactRefresh: true
    })
  ]
})
```

When enabled, the plugin injects the following scripts into the `<head>` tag:

```html
<script type="module" src="/@react-refresh"></script>
<script type="module">
  import RefreshRuntime from '/@react-refresh'
  RefreshRuntime.injectIntoGlobalHook(window)
  window.$RefreshReg$ = () => {}
  window.$RefreshSig$ = () => (type) => type
  window.__vite_plugin_react_preamble_installed__ = true
</script>
```

## What it does

- Injects `<script type="module" src="/@vite/client">` into HTML responses (only in dev)
- Optionally injects React Refresh scripts into the HTML head when `injectReactRefresh: true` is set
- Sends a full-reload signal when an SSR module is updated

## Author

Yusuke Wada <https://github.com/yusukebe>

## License
