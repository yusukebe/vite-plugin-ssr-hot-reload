import { describe, it, expect, vi } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'
import request from 'supertest'
import path from 'node:path'
import ssrHotReload from './plugin'

vi.mock('fast-glob', () => {
  return {
    default: vi.fn(() => Promise.resolve([path.resolve('src/pages/index.tsx')]))
  }
})

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

  it('sends full-reload on SSR module change', async () => {
    const server = {
      hot: {
        send: vi.fn()
      }
    } as any

    const filePath = path.resolve('src/pages/index.tsx')
    const plugin = ssrHotReload({
      entry: ['src/pages/**/*.tsx']
    })

    // @ts-ignore
    const result = plugin.handleHotUpdate?.({
      file: filePath,
      server,
      modules: [{ file: filePath }],
      timestamp: Date.now(),
      read: () => Promise.resolve('')
    })

    if (result instanceof Promise) {
      await result
    }

    expect(server.hot.send).toHaveBeenCalledWith({ type: 'full-reload' })
  })

  it('does not reload if file does not match entry', async () => {
    const server = {
      hot: {
        send: vi.fn()
      }
    } as any

    const unrelatedFile = path.resolve('src/components/Button.tsx')
    const plugin = ssrHotReload({
      entry: ['src/pages/**/*.tsx']
    })

    // @ts-ignore
    const result = plugin.handleHotUpdate?.({
      file: unrelatedFile,
      server,
      modules: [{ file: unrelatedFile }],
      timestamp: Date.now(),
      read: () => Promise.resolve('')
    })

    if (result instanceof Promise) {
      await result
    }

    expect(server.hot.send).not.toHaveBeenCalled()
  })
})
