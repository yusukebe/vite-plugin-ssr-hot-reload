import { Plugin } from 'vite'

export default function ssrHotReload(): Plugin {
  return {
    name: 'vite-plugin-ssr-hot-reload',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(function injectViteClient(_req, res, next) {
        const originalWrite = res.write
        const originalEnd = res.end

        let buffer = ''

        res.write = function (chunk: any, ...args: any[]) {
          if (chunk) {
            buffer += chunk.toString()
          }
          return true
        }

        res.end = function (chunk: any, ...args: any[]) {
          if (chunk) {
            buffer += chunk.toString()
          }

          const contentType = res.getHeader('content-type')
          if (contentType && contentType.toString().includes('text/html')) {
            const script = '<script type="module" src="/@vite/client"></script>'
            buffer += script

            if (res.getHeader('content-length')) {
              res.setHeader('content-length', Buffer.byteLength(buffer))
            }
            originalWrite.call(res, buffer, 'utf-8', undefined)
            originalEnd.call(res, null, 'utf-8', undefined)
            return res
          }

          if (buffer.length > 0) {
            originalWrite.call(res, buffer, 'utf-8', undefined)
          }
          if (chunk) {
            return originalEnd.call(res, chunk, 'utf-8', undefined)
          } else {
            return originalEnd.call(res, null, 'utf-8', undefined)
          }
        }

        next()
      })
    },
    handleHotUpdate: ({ server, modules }) => {
      const isSSR = modules.some((mod) => mod._ssrModule)
      if (isSSR) {
        server.hot.send({ type: 'full-reload' })
        return []
      }
    }
  }
}
