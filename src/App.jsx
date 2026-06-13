import { Route, Routes } from 'react-router-dom'
import Layout from './components/layout/Layout'
import ArbitragePage from './pages/ArbitragePage'
import FightDetailPage from './pages/FightDetailPage'
import HomePage from './pages/HomePage'
import MetricsPage from './pages/MetricsPage'
import ModelPage from './pages/ModelPage'
import UFCPage from './pages/UFCPage'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/ufc" element={<UFCPage />} />
        <Route path="/ufc/fights/:id" element={<FightDetailPage />} />
        <Route path="/model/upcoming" element={<ModelPage tab="upcoming" />} />
        <Route path="/model/metrics" element={<MetricsPage />} />
        <Route path="/arbitrage" element={<ArbitragePage />} />
      </Routes>
    </Layout>
  )
}
