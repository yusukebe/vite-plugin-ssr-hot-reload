import { createServer } from 'vite'
import type { ViteDevServer, Plugin, HmrContext, ModuleNode } from 'vite'
import request from 'supertest'
import path from 'node:path'
import ssrHotReload from './plugin'

describe('ssrHotReload plugin', () => {
  const callHandleHotUpdate = async (plugin: Plugin, file: string, server: any) => {
    // @ts-ignore
    plugin.configResolved?.({ root: process.cwd(), base: '/' } as any)

    const ctx: HmrContext = {
      file,
      server,
      modules: [{ file } as unknown as ModuleNode],
      timestamp: Date.now(),
      read: () => Promise.resolve('')
    }

    // @ts-ignore
    const result = plugin.handleHotUpdate?.(ctx)
    if (result instanceof Promise) await result
  }

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

  it('does inject @vite/client into HTML when injectViteClient is true', async () => {
    const viteServer: ViteDevServer = await createServer({
      root: process.cwd(),
      server: { middlewareMode: true },
      plugins: [
        ssrHotReload({
          injectViteClient: true
        }),
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
    expect(res.text.includes('<script type="module" src="/@vite/client"></script>')).toBe(true)
    await viteServer.close()
  })

  it('does not inject @vite/client into HTML when injectViteClient is false', async () => {
    const viteServer: ViteDevServer = await createServer({
      root: process.cwd(),
      server: { middlewareMode: true },
      plugins: [
        ssrHotReload({
          injectViteClient: false,
        }),
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
    expect(res.text.includes('<script type="module" src="/@vite/client"></script>')).toBe(false)
    await viteServer.close()
  })

  it('does not inject @vite/client into HTML when injectViteClient is function returning false', async () => {
    const viteServer: ViteDevServer = await createServer({
      root: process.cwd(),
      server: { middlewareMode: true },
      plugins: [
        ssrHotReload({
          injectViteClient: (_req, _res) => false,
        }),
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
    expect(res.text.includes('<script type="module" src="/@vite/client"></script>')).toBe(false)
    await viteServer.close()
  })

  it('does inject @vite/client into HTML when injectViteClient is function returning true', async () => {
    const viteServer: ViteDevServer = await createServer({
      root: process.cwd(),
      server: { middlewareMode: true },
      plugins: [
        ssrHotReload({
          injectViteClient: (_req, _res) => true,
        }),
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
    expect(res.text.includes('<script type="module" src="/@vite/client"></script>')).toBe(true)
    await viteServer.close()
  })

  it('does not inject @vite/client into HTML when injectViteClient is function with HX-Request header', async () => {
    const viteServer: ViteDevServer = await createServer({
      root: process.cwd(),
      server: { middlewareMode: true },
      plugins: [
        ssrHotReload({
          injectViteClient: (req, _res) => !Boolean(req.headers['hx-request'])
        }),
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

    const res = await request(viteServer.middlewares).get('/').set('HX-Request', 'true')
    expect(res.status).toBe(200)
    expect(res.text.includes('<script type="module" src="/@vite/client"></script>')).toBe(false)
    await viteServer.close()
  })

  it('injects React Refresh scripts into HTML head when injectReactRefresh is true', async () => {
    const viteServer: ViteDevServer = await createServer({
      root: process.cwd(),
      server: { middlewareMode: true },
      plugins: [
        ssrHotReload({ injectReactRefresh: true }),
        {
          name: 'html-mock',
          configureServer(server) {
            server.middlewares.use((_req, res) => {
              res.setHeader('content-type', 'text/html')
              res.end('<html><head></head><body><h1>Hello</h1></body></html>')
            })
          }
        }
      ]
    })

    const res = await request(viteServer.middlewares).get('/')
    expect(res.status).toBe(200)
    expect(res.text).toContain('<script type="module" src="/@react-refresh"></script>')
    expect(res.text).toContain("import RefreshRuntime from '/@react-refresh'")
    expect(res.text).toContain('window.__vite_plugin_react_preamble_installed__ = true')
    await viteServer.close()
  })

  it('does not inject React Refresh scripts when injectReactRefresh is false', async () => {
    const viteServer: ViteDevServer = await createServer({
      root: process.cwd(),
      server: { middlewareMode: true },
      plugins: [
        ssrHotReload({ injectReactRefresh: false }),
        {
          name: 'html-mock',
          configureServer(server) {
            server.middlewares.use((_req, res) => {
              res.setHeader('content-type', 'text/html')
              res.end('<html><head></head><body><h1>Hello</h1></body></html>')
            })
          }
        }
      ]
    })

    const res = await request(viteServer.middlewares).get('/')
    expect(res.status).toBe(200)
    expect(res.text).not.toContain('<script type="module" src="/@react-refresh"></script>')
    await viteServer.close()
  })

  it('sends full-reload on SSR module change (matched)', async () => {
    const server = { hot: { send: vi.fn() } }
    const file = path.resolve('src/pages/index.tsx')
    const plugin = ssrHotReload({ entry: [file] })
    await callHandleHotUpdate(plugin, file, server)
    expect(server.hot.send).toHaveBeenCalledWith({ type: 'full-reload' })
  })

  it('does not reload when file does not match entry patterns', async () => {
    const server = { hot: { send: vi.fn() } }
    const file = path.resolve('src/other/File.ts')
    const plugin = ssrHotReload({ entry: ['src/pages/**/*.tsx'] })
    await callHandleHotUpdate(plugin, file, server)
    expect(server.hot.send).not.toHaveBeenCalled()
  })

  it('does not reload when file matches ignore patterns', async () => {
    const server = { hot: { send: vi.fn() } }
    const file = path.resolve('src/pages/ignored.tsx')
    const plugin = ssrHotReload({ entry: ['src/pages/**/*.tsx'], ignore: ['src/pages/ignored.tsx'] })
    await callHandleHotUpdate(plugin, file, server)
    expect(server.hot.send).not.toHaveBeenCalled()
  })

  it('reloads when entry uses leading slash', async () => {
    const server = { hot: { send: vi.fn() } }
    const file = path.resolve('src/pages/slash-path.tsx')
    const plugin = ssrHotReload({ entry: ['/src/pages/slash-path.tsx'] })
    await callHandleHotUpdate(plugin, file, server)
    expect(server.hot.send).toHaveBeenCalledWith({ type: 'full-reload' })
  })

  it('reloads when entry uses dot-slash prefix', async () => {
    const server = { hot: { send: vi.fn() } }
    const file = path.resolve('src/pages/dot-slash-path.tsx')
    const plugin = ssrHotReload({ entry: ['./src/pages/dot-slash-path.tsx'] })
    await callHandleHotUpdate(plugin, file, server)
    expect(server.hot.send).toHaveBeenCalledWith({ type: 'full-reload' })
  })

  it('reloads when entry is absolute path', async () => {
    const server = { hot: { send: vi.fn() } }
    const file = path.resolve('src/pages/test-absolute-file.tsx')
    const plugin = ssrHotReload({ entry: [file] })
    await callHandleHotUpdate(plugin, file, server)
    expect(server.hot.send).toHaveBeenCalledWith({ type: 'full-reload' })
  })

  it('does not reload when entry is ./src and ignore is /src', async () => {
    const server = { hot: { send: vi.fn() } }
    const file = path.resolve('src/pages/ignored.tsx')
    const plugin = ssrHotReload({
      entry: ['./src/pages/ignored.tsx'],
      ignore: ['/src/pages/ignored.tsx']
    })
    await callHandleHotUpdate(plugin, file, server)
    expect(server.hot.send).not.toHaveBeenCalled()
  })

  it('sets correct Content-Length after injection', async () => {
    const viteServer: ViteDevServer = await createServer({
      root: process.cwd(),
      server: { middlewareMode: true },
      plugins: [
        ssrHotReload({ injectReactRefresh: true }),
        {
          name: 'html-mock',
          configureServer(server) {
            server.middlewares.use((_req, res) => {
              res.setHeader('content-type', 'text/html')
              res.end('<html><head></head><body><h1>Hello</h1></body></html>')
            })
          }
        }
      ]
    })
    const res = await request(viteServer.middlewares).get('/')
    const contentLength = Number(res.header['content-length'])
    expect(res.status).toBe(200)
    expect(contentLength).toBeGreaterThan(0)
    expect(res.text.length).toBe(contentLength)
    await viteServer.close()
  })
})
