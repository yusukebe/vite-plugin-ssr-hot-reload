import { createServer, type ViteDevServer } from 'vite'
import request from 'supertest'
import path from 'node:path'
import ssrHotReload from './plugin'

// Mock fs module
vi.mock('node:fs', () => ({
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true)
}))

// Mock glob function
vi.mock('glob', () => ({
  glob: vi.fn().mockImplementation((patterns, options) => {
    // Simple mock implementation that returns files based on patterns and ignore
    const mockFiles = [
      path.resolve('src/pages/index.tsx'),
      path.resolve('src/pages/ignored.tsx'),
      path.resolve('src/pages/relative/ignored.tsx'),
      path.resolve('src/pages/test-absolute-file.tsx')
    ]

    // Filter out ignored files
    const ignorePatterns = options.ignore || []
    const cwd = options.cwd || process.cwd()

    return Promise.resolve(
      mockFiles.filter((file) => {
        return !ignorePatterns.some((pattern: string) => {
          if (path.isAbsolute(pattern)) {
            return file === pattern
          }
          // Handle relative patterns
          const resolvedPattern = path.resolve(cwd, pattern)
          return file === resolvedPattern
        })
      })
    )
  })
}))

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

    // No need to actually create files, we're mocking fs
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

  it('does not reload when file does not match entry patterns', async () => {
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

  it('does not reload when file matches ignore patterns', async () => {
    const server = {
      hot: {
        send: vi.fn()
      }
    } as any

    // Create a file that would match entry but also matches ignore
    const changedFile = path.resolve('src/pages/ignored.tsx')
    const plugin = ssrHotReload({
      entry: ['src/pages/**/*.tsx'],
      ignore: ['src/pages/ignored.tsx']
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

  it('does not reload when file matches relative path ignore patterns', async () => {
    const server = {
      hot: {
        send: vi.fn()
      }
    } as any

    // Create a file that would match entry but also matches ignore with relative path
    const changedFile = path.resolve('src/pages/relative/ignored.tsx')

    // Define a test directory path (no need to actually create it)
    const testDir = path.resolve('src/test')

    // Use a relative path for ignore (../pages/relative/ignored.tsx from src/test)
    const plugin = ssrHotReload({
      entry: ['src/pages/**/*.tsx'],
      ignore: ['../pages/relative/ignored.tsx']
    })

    // Mock process.cwd() to return the test directory
    const originalCwd = process.cwd
    process.cwd = vi.fn().mockReturnValue(testDir)

    try {
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
    } finally {
      // Restore original cwd
      process.cwd = originalCwd
    }
  })

  it('does not reload when absolute file path matches relative ignore pattern', async () => {
    const server = {
      hot: {
        send: vi.fn()
      }
    } as any

    // Define a file with absolute path that would match entry and a relative ignore pattern
    const absoluteFilePath = path.resolve('src/pages/test-absolute-file.tsx')

    // Use a simple relative path for ignore (without ../)
    const plugin = ssrHotReload({
      entry: ['src/pages/**/*.tsx'],
      ignore: ['src/pages/test-absolute-file.tsx'] // Simple relative path
    })

    // @ts-ignore
    const result = plugin.handleHotUpdate?.({
      file: absoluteFilePath, // Absolute file path
      server,
      modules: [{ file: absoluteFilePath }],
      timestamp: Date.now(),
      read: () => Promise.resolve('')
    })

    if (result instanceof Promise) {
      await result
    }

    expect(server.hot.send).not.toHaveBeenCalled()
  })
})
