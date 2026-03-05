// app/manifest.ts
import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TwoPiR',
    short_name: 'TwoPiR',
    description: 'Staking rewards tracker',
    start_url: '/',
    display: 'standalone',
    background_color: '#f0f4f8',
    theme_color: '#2dd4a8',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}