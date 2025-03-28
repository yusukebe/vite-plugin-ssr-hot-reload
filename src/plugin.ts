import { Plugin, normalizePath } from 'vite'
import path from 'node:path'
import picomatch from 'picomatch'
import type { ServerResponse } from 'node:http'

type Options = {
  entry?: string | string[]
  ignore?: string | string[]
  injectReactRefresh?: boolean
}

export default function ssrHotReload(options: Options = {}): Plugin {
  const entryPatterns = Array.isArray(options.entry)
    ? options.entry
    : options.entry
    ? [options.entry]
    : ['src/**/*.ts', 'src/**/*.tsx']

  const ignorePatterns = Array.isArray(options.ignore) ? options.ignore : options.ignore ? [options.ignore] : []

  const injectReactRefresh = options.injectReactRefresh ?? false

  let root = process.cwd()
  let isMatch: (file: string) => boolean

  return {
    name: 'vite-plugin-ssr-hot-reload',
    apply: 'serve',

    configResolved(config) {
      root = config.root || process.cwd()

      const normalizedEntries = entryPatterns.map((p) => normalizeGlobPattern(p, root))
      const normalizedIgnores = ignorePatterns.map((p) => normalizeGlobPattern(p, root))

      const matcher = picomatch(normalizedEntries, {
        ignore: normalizedIgnores,
        dot: true
      })

      isMatch = (filePath: string) => {
        const rel = normalizePath(path.relative(root, filePath))
        return matcher(rel)
      }
    },

    configureServer(server) {
      server.middlewares.use((_req, res: ServerResponse, next) => {
        const originalEnd = res.end.bind(res)

        res.end = function (chunk: any, ...args: any[]) {
          const contentType = res.getHeader('content-type')
          if (typeof contentType === 'string' && contentType.includes('text/html')) {
            let html = chunk ? chunk.toString() : ''

            // Inject React Refresh scripts into head if enabled
            if (injectReactRefresh && html.includes('</head>') && !html.includes('/@react-refresh')) {
              const reactRefreshScript = `<script type="module" src="/@react-refresh"></script>
<script type="module">
  import RefreshRuntime from '/@react-refresh'
  RefreshRuntime.injectIntoGlobalHook(window)
  window.$RefreshReg$ = () => {}
  window.$RefreshSig$ = () => (type) => type
  window.__vite_plugin_react_preamble_installed__ = true
</script>`
              html = html.replace('</head>', `${reactRefreshScript}\n</head>`)
            }

            // Inject Vite client script if not already present
            if (!html.includes('/@vite/client')) {
              const script = `<script type="module" src="/@vite/client"></script>`
              html = html.includes('</body>') ? html.replace('</body>', `${script}\n</body>`) : html + `\n${script}`
              const newChunk = Buffer.isBuffer(chunk) ? Buffer.from(html) : html
              return originalEnd(newChunk, ...args)
            }
          }
          return originalEnd(chunk, ...args)
        } as any

        next()
      })
    },

    handleHotUpdate({ server, file }) {
      if (!file) return

      if (isMatch?.(file)) {
        server.hot.send({ type: 'full-reload' })
        return []
      }
    }
  }

  function normalizeGlobPattern(pattern: string, root: string): string {
    const normalized = normalizePath(pattern)

    if (path.isAbsolute(normalized)) {
      const relative = path.relative(root, normalized)
      if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
        return normalizePath(relative)
      }
      return normalized.slice(1)
    }

    if (normalized.startsWith('/')) {
      return normalized.slice(1)
    }

    if (normalized.startsWith('./')) {
      return normalized.slice(2)
    }

    return normalized
  }
}
