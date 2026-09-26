import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './presentation/theme/tokens.css'
import './presentation/theme/fonts.css'
import './presentation/theme/global.css'
import App from './app/App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
