import {
  defineConfig,
  minimal2023Preset,
} from '@vite-pwa/assets-generator/config'

export default defineConfig({
  headLinkOptions: {
    preset: '2023',
  },
  preset: {
    ...minimal2023Preset,
    // Keep the dark slate background on padded/maskable variants
    maskable: {
      ...minimal2023Preset.maskable,
      resizeOptions: {
        background: '#0f172a',
        fit: 'contain',
      },
    },
    apple: {
      ...minimal2023Preset.apple,
      resizeOptions: {
        background: '#0f172a',
        fit: 'contain',
      },
    },
  },
  images: ['public/icon-source.svg'],
})
