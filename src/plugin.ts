import { Plugin } from 'vite'
import { glob } from 'glob'
import path from 'node:path'
import type { ServerResponse } from 'node:http'

type Options = {
  entry?: string | string[]
}

export default function ssrHotReload(options: Options = {}): Plugin {
  const entryPatterns = Array.isArray(options.entry) ? options.entry : [options.entry ?? 'src/**/*.ts', 'src/**/*.tsx']

  const root = process.cwd()

  return {
    name: 'vite-plugin-ssr-hot-reload',
    apply: 'serve',

    configureServer(server) {
      server.middlewares.use((_req, res: ServerResponse, next) => {
        let buffer = ''

        const originalWrite = res.write.bind(res)
        const originalEnd = res.end.bind(res)

        res.write = ((chunk: any, ..._args: any[]) => {
          if (chunk) buffer += chunk.toString()
          return true
        }) as typeof res.write

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

          originalWrite(buffer)
          originalEnd()
        }) as typeof res.end

        next()
      })
    },

    async handleHotUpdate({ server, modules }) {
      const changedFiles = modules.map((m) => m.file).filter(Boolean) as string[]
      if (changedFiles.length === 0) return

      const matched = await glob(entryPatterns, { cwd: root, absolute: true })
      const matchedSet = new Set(matched.map((f) => path.resolve(f)))

      const shouldReload = changedFiles.some((file) => matchedSet.has(path.resolve(file)))
      if (shouldReload) {
        server.hot.send({ type: 'full-reload' })
        return []
      }
    }
  }
}
