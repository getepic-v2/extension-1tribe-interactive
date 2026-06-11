import http from 'node:http'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'

const port = Number(process.env.PORT || 8080)
const distDir = path.resolve('dist-extension')
const publicDir = path.resolve('public')

const contentTypes = new Map([
  ['.js', 'application/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.riv', 'application/octet-stream'],
  ['.wasm', 'application/wasm'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.svg', 'image/svg+xml'],
])

function getSafeFilePath(rootDir, pathname) {
  const filePath = path.resolve(rootDir, pathname.slice(1))
  const rootWithSeparator = `${rootDir}${path.sep}`

  if (filePath !== rootDir && !filePath.startsWith(rootWithSeparator)) {
    return null
  }

  return filePath
}

async function serveFile(req, res, filePath) {
  const fileStat = await stat(filePath)
  if (!fileStat.isFile()) return false

  res.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Expose-Headers': 'Content-Length',
    'Cache-Control': 'no-store',
    'Content-Length': String(fileStat.size),
    'Content-Type': contentTypes.get(path.extname(filePath)) || 'application/octet-stream',
  })

  if (req.method === 'HEAD') {
    res.end()
    return true
  }

  createReadStream(filePath).pipe(res)
  return true
}

function getSearchRoots(pathname) {
  const publicFirst =
    pathname === '/rive-files.json' ||
    pathname.startsWith('/rive/') ||
    pathname.startsWith('/vendor/') ||
    pathname.endsWith('.html')

  return publicFirst ? [publicDir, distDir] : [distDir, publicDir]
}

const server = http.createServer(async (req, res) => {
  const pathname = decodeURIComponent(req.url?.split('?')[0] || '/')

  if (pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end(`Extension dev server running on http://localhost:${port}`)
    return
  }

  for (const rootDir of getSearchRoots(pathname)) {
    const filePath = getSafeFilePath(rootDir, pathname)
    if (!filePath) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Forbidden')
      return
    }

    try {
      if (await serveFile(req, res, filePath)) return
    } catch {
      // Try the next static root.
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end(`${pathname.slice(1)} not found in dist-extension or public. Run npm run build:extension first.`)
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Dev server: http://localhost:${port}`)
})
