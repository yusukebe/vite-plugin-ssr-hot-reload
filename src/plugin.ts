import { Plugin, normalizePath } from 'vite'
import path from 'node:path'
import picomatch from 'picomatch'
import type { ServerResponse } from 'node:http'


type ShouldInjectFunction = (req: ServerResponse['req'], res: ServerResponse) => boolean

type Options = {
  /**
   * default ['src\/\*\*\/\*.ts', 'src\/\*\*\/\*.tsx']
   */
  entry?: string | string[]

  ignore?: string | string[],
  /**
   * default: true
   */
  injectViteClient?: boolean | ShouldInjectFunction
  /**
   * default: false
   */
  injectReactRefresh?: boolean | ShouldInjectFunction
}

function intoShouldInjectFunction(value: boolean | ShouldInjectFunction | undefined, defaultValue: boolean): ShouldInjectFunction {
  switch (typeof value) {
    case 'boolean': return (_req, _res) => value;
    case 'function': return value;
    default:
      return (_req, _res) => defaultValue
  }
}

export default function ssrHotReload(options: Options = {}): Plugin {
  const entryPatterns = Array.isArray(options.entry)
    ? options.entry
    : options.entry
    ? [options.entry]
    : ['src/**/*.ts', 'src/**/*.tsx']

  const ignorePatterns = Array.isArray(options.ignore) ? options.ignore : options.ignore ? [options.ignore] : []

  const injectReactRefresh = intoShouldInjectFunction(options.injectReactRefresh, false)
  const injectViteClientFn = intoShouldInjectFunction(options.injectViteClient, true)

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
      server.middlewares.use((req, res: ServerResponse, next) => {
        const originalEnd = res.end.bind(res)
        const chunks: Buffer[] = []

        res.write = function (chunk: any, ..._args: any[]) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
          return true
        }

        res.end = function (chunk: any, ...args: any[]) {
          if (chunk) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
          }

          const contentType = res.getHeader('content-type')
          const isHtml = typeof contentType === 'string' && contentType.includes('text/html')
          if (!isHtml) {
            return originalEnd(Buffer.concat(chunks), ...args)
          }

          const html = Buffer.concat(chunks).toString()
          let finalHtml = html

          const hasRefresh = html.includes('/@react-refresh')
          const hasViteClient = html.includes('/@vite/client')

          let injection = ''

          if (injectReactRefresh(req, res) && !hasRefresh) {
            injection += `<script type="module" src="/@react-refresh"></script>
<script type="module">
  import RefreshRuntime from '/@react-refresh'
  RefreshRuntime.injectIntoGlobalHook(window)
  window.$RefreshReg$ = () => {}
  window.$RefreshSig$ = () => (type) => type
  window.__vite_plugin_react_preamble_installed__ = true
</script>\n`
          }

          if (injectViteClientFn(req, res) && !hasViteClient ) {
            injection += `<script type="module" src="/@vite/client"></script>\n`
          }

          if (injection) {
            if (html.includes('<head>')) {
              finalHtml = finalHtml.replace('<head>', `<head>\n${injection}`)
            } else if (html.includes('<html>')) {
              finalHtml = finalHtml.replace('<html>', `<html>\n${injection}`)
            } else {
              finalHtml = `${injection}${finalHtml}`
            }
          }

          const encoder = new TextEncoder()
          const encoded = encoder.encode(finalHtml)

          res.setHeader('Content-Length', encoded.length)

          return originalEnd(Buffer.from(encoded), ...args)
        }

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
