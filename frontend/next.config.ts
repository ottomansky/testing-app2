import type { NextConfig } from 'next'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  output: 'standalone', // Required for Keboola Docker deployment
  outputFileTracingRoot: __dirname,

  // Proxy /api/* to the FastAPI backend during local development
  async rewrites() {
    return [
      { source: '/api/:path*', destination: 'http://localhost:8050/api/:path*' },
    ]
  },
}

export default nextConfig
