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
      // Use a much simpler approach to inject the client script
      server.middlewares.use((_req, res: ServerResponse, next) => {
        const originalEnd = res.end.bind(res)

        // Override the end method
        res.end = function (chunk: any, ...args: any[]) {
          // Only process if this is an HTML response
          const contentType = res.getHeader('content-type')
          if (typeof contentType === 'string' && contentType.includes('text/html')) {
            // Convert chunk to string if it exists
            let html = chunk ? chunk.toString() : ''

            // Only inject if not already present
            if (!html.includes('/@vite/client')) {
              const script = `<script type="module" src="/@vite/client"></script>`

              // Try to inject before </body> if it exists
              if (html.includes('</body>')) {
                html = html.replace('</body>', `${script}\n</body>`)
              } else {
                // Otherwise append to the end
                html += `\n${script}`
              }

              // Convert back to Buffer if needed
              const newChunk = Buffer.isBuffer(chunk) ? Buffer.from(html) : html

              // Call the original end with the modified chunk
              return originalEnd(newChunk, ...args)
            }
          }

          // Call the original end for non-HTML responses or if already injected
          return originalEnd(chunk, ...args)
        } as any

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
