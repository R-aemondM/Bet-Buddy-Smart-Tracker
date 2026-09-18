import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    // Netlify provides environment variables on process.env during build,
    // while local .env files are loaded via loadEnv. Check all possible names.
    const geminiKey = process.env.GEMINI_API_KEY 
      || env.GEMINI_API_KEY 
      || process.env.VITE_GEMINI_API_KEY 
      || env.VITE_GEMINI_API_KEY 
      || process.env.API_KEY 
      || env.API_KEY 
      || process.env.EXAMPLE_KEY 
      || env.EXAMPLE_KEY 
      || '';
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(geminiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(geminiKey),
        'process.env.EXAMPLE_KEY': JSON.stringify(geminiKey),
        'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(geminiKey),
        'import.meta.env.GEMINI_API_KEY': JSON.stringify(geminiKey),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
