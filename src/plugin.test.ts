import { describe, it, expect, vi } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'
import request from 'supertest'
import path from 'node:path'
import fs from 'node:fs'
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

  it('sends full-reload on SSR module change (matched)', async () => {
    const server = {
      hot: {
        send: vi.fn()
      }
    } as any

    const testFile = path.resolve('src/pages/index.tsx')

    fs.mkdirSync(path.dirname(testFile), { recursive: true })
    fs.writeFileSync(testFile, '// mock file')

    const plugin = ssrHotReload({
      entry: [testFile]
    })

    // @ts-ignore
    const result = plugin.handleHotUpdate?.({
      file: testFile,
      server,
      modules: [{ file: testFile }],
      timestamp: Date.now(),
      read: () => Promise.resolve('')
    })

    if (result instanceof Promise) {
      await result
    }

    expect(server.hot.send).toHaveBeenCalledWith({ type: 'full-reload' })
  })

  it('does not reload when file does not match entry', async () => {
    const server = {
      hot: {
        send: vi.fn()
      }
    } as any

    const changedFile = path.resolve('src/other/File.ts')
    const plugin = ssrHotReload({
      entry: ['src/pages/**/*.tsx']
    })

    // @ts-ignore
    const result = plugin.handleHotUpdate?.({
      file: changedFile,
      server,
      modules: [{ file: changedFile }],
      timestamp: Date.now(),
      read: () => Promise.resolve('')
    })

    if (result instanceof Promise) {
      await result
    }

    expect(server.hot.send).not.toHaveBeenCalled()
  })
})
