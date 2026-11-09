import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { Toaster } from 'react-hot-toast'
import App from './App'
import store from './store'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            background: '#1B2340',
            color: '#fff',
            fontSize: '14px',
          },
          success: { iconTheme: { primary: '#C9962C', secondary: '#fff' } },
        }}
      />
    </Provider>
  </React.StrictMode>
)