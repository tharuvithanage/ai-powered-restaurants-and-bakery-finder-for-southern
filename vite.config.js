import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(() => {
  // Helpful for remote dev (AnyDesk/RDP/VM shares) and for LAN access.
  // Override via env if you ever need a different port.
  const port = Number(process.env.VITE_PORT) || 5178
  const clientPort = Number(process.env.VITE_HMR_CLIENT_PORT) || port

  return {
    plugins: [react()],
    server: {
      host: true,
      port,
      strictPort: true,
      watch: {
        usePolling: true,
      },
      hmr: {
        // When the server is reachable but the client guesses the wrong port,
        // Fast Refresh will keep trying to reconnect in a loop.
        clientPort,
      },
    },
  }
})
