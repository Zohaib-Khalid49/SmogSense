import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './index.css'
import App from './App.jsx'
import { isFirebaseConfigured } from './lib/firebase'
import { storeAlertPayload } from './lib/push'

// ── Firebase service worker message bridge ───────────────────────────
// When the SW receives a notification click, it sends ALERT_PAYLOAD
// via postMessage. Store it in sessionStorage for AlertDetail to read.
if (isFirebaseConfigured && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'ALERT_PAYLOAD') {
      storeAlertPayload(event.data.data)
    }
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
