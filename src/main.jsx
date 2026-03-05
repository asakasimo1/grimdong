import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import './index.css'

// 카카오 SDK 초기화
if (window.Kakao && !window.Kakao.isInitialized()) {
  window.Kakao.init(import.meta.env.VITE_KAKAO_JS_KEY)
}

createRoot(document.getElementById('root')).render(
  <BrowserRouter basename={import.meta.env.DEV ? '/' : '/grimdong'}>
    <App />
    <Toaster position="top-center" />
  </BrowserRouter>,
)
