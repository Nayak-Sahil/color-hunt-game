import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'
import { unlockAudio } from './game/ui/sound'
import { isLiteMode } from './ui/LazyShowcase'

// Remember `?lite` before the router redirects and drops the query string.
isLiteMode()

// Browsers only allow audio after a user gesture; unlock on the first one.
window.addEventListener('pointerdown', unlockAudio, { once: true })
window.addEventListener('keydown', unlockAudio, { once: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
