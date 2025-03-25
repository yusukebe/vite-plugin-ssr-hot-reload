import { createServer, type ViteDevServer } from 'vite'
import request from 'supertest'
import ssrHotReload from './plugin'

describe('ssrHotReload plugin', () => {
  it('injects @vite/client into HTML', async () => {
    const viteServer: ViteDevServer = await createServer({
      root: process.cwd(),
      server: { middlewareMode: true },
      plugins: [
        ssrHotReload(),
        {
          name: 'html-mock',
          configureServer(server) {
            server.middlewares.use((_req, res) => {
              res.setHeader('content-type', 'text/html')
              res.end('<html><body><h1>Hello</h1></body></html>')
            })
          }
        }
      ]
    })

    const res = await request(viteServer.middlewares).get('/')
    expect(res.status).toBe(200)
    expect(res.text).toContain('<script type="module" src="/@vite/client"></script>')

    await viteServer.close()
  })

  it('sends full-reload on SSR module change', () => {
    const server = {
      hot: {
        send: vi.fn()
      }
    } as any

    const ssrMod = { _ssrModule: true }
    // @ts-ignore
    ssrHotReload().handleHotUpdate?.({
      file: '/src/index.tsx',
      server,
      modules: [ssrMod],
      timestamp: Date.now(),
      read: () => Promise.resolve('')
    } as any)

    expect(server.hot.send).toHaveBeenCalledWith({ type: 'full-reload' })
  })
})
