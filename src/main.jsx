import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initTheme } from './utils/theme'

initTheme() // 表示（自動・ライト・ダーク）を当てる

// 「更新する」で付けた ?v=… を、アドレスから消す（見た目だけ。読み込みは済んでいる）
try {
  const url = new URL(window.location.href)
  if (url.searchParams.has('v')) {
    url.searchParams.delete('v')
    window.history.replaceState(null, '', url.toString())
  }
} catch {
  // 消せなくても、動作には影響しない
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)