import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { TooltipProvider } from './components/ui/tooltip'
import App from './App'
import './styles/index.css'
import 'flag-icons/css/flag-icons.min.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <TooltipProvider delayDuration={200}>
        <App />
      </TooltipProvider>
    </BrowserRouter>
  </StrictMode>,
)
