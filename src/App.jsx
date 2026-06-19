import { Route, Routes } from 'react-router-dom'
import Layout from './components/layout/Layout'
import FightDetailPage from './pages/FightDetailPage'
import FighterDecompositionsPage from './pages/FighterDecompositionsPage'
import FighterProfilePage from './pages/FighterProfilePage'
import FighterStatsPage from './pages/FighterStatsPage'
import ModelPage from './pages/ModelPage'
import UFCPage from './pages/UFCPage'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<ModelPage tab="upcoming" />} />
        <Route path="/ufc" element={<UFCPage />} />
        <Route path="/ufc/fights/:id" element={<FightDetailPage />} />
        <Route path="/ufc/rankings" element={<FighterDecompositionsPage />} />
        <Route path="/model/upcoming" element={<ModelPage tab="upcoming" />} />
        <Route path="/ufc/fighters/:id" element={<FighterProfilePage />} />
        <Route path="/ufc/fighters/stats" element={<FighterStatsPage />} />
        <Route path="/ufc/fighters/decompositions" element={<FighterDecompositionsPage />} />
      </Routes>
    </Layout>
  )
}
