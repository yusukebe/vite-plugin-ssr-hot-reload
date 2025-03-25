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

## What it does

- Injects `<script type="module" src="/@vite/client">` into HTML responses (only in dev)
- Sends a full-reload signal when an SSR module is updated

## Author

Yusuke Wada <https://github.com/yusukebe>

## License
