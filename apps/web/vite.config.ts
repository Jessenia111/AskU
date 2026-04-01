import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    // Allow access from local network (other devices on the same Wi-Fi).
    // Set VITE_API_BASE in .env to your computer's LAN IP, e.g. http://192.168.1.42:8000
    host: true,
    port: 5173,
  },
})
