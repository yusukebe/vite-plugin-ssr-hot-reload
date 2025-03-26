import { Plugin, normalizePath } from 'vite'
import { glob } from 'glob'
import path from 'node:path'
import type { ServerResponse } from 'node:http'

type Options = {
  entry?: string | string[]
  ignore?: string | string[]
}

export default function ssrHotReload(options: Options = {}): Plugin {
  const entryPatterns = Array.isArray(options.entry)
    ? options.entry
    : options.entry
    ? [options.entry]
    : ['src/**/*.ts', 'src/**/*.tsx']
  const ignorePatterns = Array.isArray(options.ignore) ? options.ignore : options.ignore ? [options.ignore] : []

  const root = process.cwd()

  const normalizePattern = (pattern: string) => {
    // Normalize the pattern to use forward slashes
    const normalizedPattern = normalizePath(pattern)

    // Handle absolute file system paths
    if (path.isAbsolute(normalizedPattern)) {
      const relativePath = path.relative(root, normalizedPattern)
      return relativePath.startsWith('..') ? normalizedPattern : relativePath
    }

    // Handle paths that start with a slash (relative to project root)
    if (normalizedPattern.startsWith('/')) {
      // Remove the leading slash to make it relative to the root
      return normalizedPattern.slice(1)
    }

    // Handle paths that start with './'
    if (normalizedPattern.startsWith('./')) {
      // Remove the './' prefix
      return normalizedPattern.slice(2)
    }

    // Return other patterns as is
    return normalizedPattern
  }

  const normalizedEntryPatterns = entryPatterns.map(normalizePattern)
  const normalizedIgnorePatterns = ignorePatterns.map(normalizePattern)

  return {
    name: 'vite-plugin-ssr-hot-reload',
    apply: 'serve',

    configureServer(server) {
      server.middlewares.use((_req, res: ServerResponse, next) => {
        let buffer = ''

        const originalWrite = res.write.bind(res)
        const originalEnd = res.end.bind(res)

        res.write = (chunk: any, ...args: any[]) => {
          if (chunk) buffer += chunk.toString()
          return originalWrite(chunk, ...args)
        }

        res.end = ((chunk: any, ..._args: any[]) => {
          if (chunk) buffer += chunk.toString()

          const contentType = res.getHeader('content-type')
          const isHTML = typeof contentType === 'string' && contentType.includes('text/html')
          const alreadyInjected = buffer.includes('/@vite/client')
          const script = `<script type="module" src="/@vite/client"></script>`

          if (isHTML && !alreadyInjected) {
            buffer += `\n${script}`
            res.setHeader('content-length', Buffer.byteLength(buffer))
          }

          originalEnd(buffer)
        }) as typeof res.end

        next()
      })
    },

    async handleHotUpdate({ server, file }) {
      if (!file) return

      const changedFiles = [file]
      const matched = await glob(normalizedEntryPatterns, {
        cwd: root,
        absolute: true,
        ignore: normalizedIgnorePatterns
      })
      const matchedSet = new Set(matched.map((f) => path.resolve(f)))

      const shouldReload = changedFiles.some((file) => matchedSet.has(path.resolve(file)))
      if (shouldReload) {
        server.hot.send({ type: 'full-reload' })
        return []
      }
    }
  }
}
