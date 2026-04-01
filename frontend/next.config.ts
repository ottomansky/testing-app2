import type { NextConfig } from 'next'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  output: 'standalone',
  // Fix: local env has ~/package-lock.json which confuses Next.js workspace detection.
  // This ensures standalone output is flat (server.js at root, not nested under full path).
  outputFileTracingRoot: __dirname,
  async rewrites() {
    return [
      { source: '/api/:path*', destination: 'http://localhost:8050/api/:path*' },
    ]
  },
}

export default nextConfig
