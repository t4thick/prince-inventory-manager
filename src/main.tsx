import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Retire only legacy shop data, preserving Supabase login and device preferences.
try { localStorage.removeItem('prince-offline-sales') } catch { /* Storage may be restricted. */ }
if ('caches' in window) void caches.delete('supabase-api').catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
