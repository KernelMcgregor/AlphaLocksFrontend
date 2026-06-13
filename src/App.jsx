import { Route, Routes } from 'react-router-dom'
import Layout from './components/layout/Layout'
import FightDetailPage from './pages/FightDetailPage'
import HomePage from './pages/HomePage'
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
      </Routes>
    </Layout>
  )
}
