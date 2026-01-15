import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    vue(),
    electron([
      {
        entry: resolve(__dirname, 'src/main/index.ts'),
        vite: {
          build: {
            outDir: resolve(__dirname, 'dist-electron/main'),
            lib: {
              formats: ['cjs'],
              entry: resolve(__dirname, 'src/main/index.ts'),
              fileName: () => 'index.js'
            },
            rollupOptions: {
              external: ['electron', 'ssh2', 'ssh2-sftp-client', 'electron-store']
            }
          }
        }
      },
      {
        entry: resolve(__dirname, 'src/main/preload.ts'),
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            outDir: resolve(__dirname, 'dist-electron/preload'),
            lib: {
              formats: ['cjs'],
              entry: resolve(__dirname, 'src/main/preload.ts'),
              fileName: () => 'index.js'
            },
            rollupOptions: {
              external: ['electron']
            }
          }
        }
      }
    ]),
    renderer()
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer')
    }
  },
  root: resolve(__dirname, 'src/renderer'),
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name].[ext]',
        chunkFileNames: 'assets/[name].[hash].js',
        entryFileNames: 'assets/[name].[hash].js'
      }
    }
  },
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173
  }
});


