import sharp from 'sharp'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const svg = readFileSync(resolve(__dirname, 'icon.svg'))

await sharp(svg).resize(192, 192).png().toFile(resolve(__dirname, '../public/pwa-192x192.png'))
console.log('✓ pwa-192x192.png')

await sharp(svg).resize(512, 512).png().toFile(resolve(__dirname, '../public/pwa-512x512.png'))
console.log('✓ pwa-512x512.png')

await sharp(svg).resize(180, 180).png().toFile(resolve(__dirname, '../public/apple-touch-icon.png'))
console.log('✓ apple-touch-icon.png')
