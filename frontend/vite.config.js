import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// Configuración estándar para React + Tailwind
export default defineConfig({
  plugins: [react()],
})
