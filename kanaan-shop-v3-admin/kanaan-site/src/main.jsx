import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ShopGate } from './components/ShopShut.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ShopGate>
      <App />
    </ShopGate>
  </React.StrictMode>,
)
