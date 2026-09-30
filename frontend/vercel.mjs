const renderApiOrigin = process.env.RENDER_API_ORIGIN?.trim().replace(/\/+$/, '')

if (!renderApiOrigin || !renderApiOrigin.startsWith('https://')) {
  throw new Error('Defina RENDER_API_ORIGIN na Vercel com uma origem HTTPS do Render.')
}

export const config = {
  framework: 'vite',
  buildCommand: 'npm run build:vercel',
  outputDirectory: 'dist',
  rewrites: [
    {
      source: '/api/:path*',
      destination: `${renderApiOrigin}/api/:path*`,
    },
    {
      source: '/:path*',
      destination: '/index.html',
    },
  ],
}
