import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initTheme } from './utils/theme'

initTheme() // 表示（自動・ライト・ダーク）を当てる

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)