import { Route, Routes } from 'react-router-dom'
import Layout from './components/layout/Layout'
import FightDetailPage from './pages/FightDetailPage'
import ModelPage from './pages/ModelPage'
import RankingsPage from './pages/RankingsPage'
import UFCPage from './pages/UFCPage'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<ModelPage tab="upcoming" />} />
        <Route path="/ufc" element={<UFCPage />} />
        <Route path="/ufc/fights/:id" element={<FightDetailPage />} />
        <Route path="/ufc/rankings" element={<RankingsPage />} />
        <Route path="/model/upcoming" element={<ModelPage tab="upcoming" />} />
      </Routes>
    </Layout>
  )
}
