import { Route, Routes } from 'react-router-dom'
import Layout from './components/layout/Layout'
import ArticlesPage from './pages/ArticlesPage'
import FightDetailPage from './pages/FightDetailPage'
import FightPreviewPage from './pages/FightPreviewPage'
import FighterDecompositionsPage from './pages/FighterDecompositionsPage'
import FighterProfilePage from './pages/FighterProfilePage'
import FighterStatsPage from './pages/FighterStatsPage'
import RankingsPage from './pages/RankingsPage'
import PicksPage from './pages/PicksPage'
import UFCHomePage from './pages/UFCHomePage'
import UFCPage from './pages/UFCPage'
import UpcomingPage from './pages/UpcomingPage'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<UpcomingPage />} />
        <Route path="/ufc" element={<UFCHomePage />} />
        <Route path="/ufc/events" element={<UFCPage />} />
        <Route path="/ufc/articles" element={<ArticlesPage />} />
        <Route path="/ufc/fights/:id" element={<FightDetailPage />} />
        <Route path="/ufc/fights/:id/preview" element={<FightPreviewPage />} />
        <Route path="/ufc/rankings" element={<RankingsPage />} />
        <Route path="/model/upcoming" element={<UpcomingPage />} />
        <Route path="/picks" element={<PicksPage />} />
        <Route path="/ufc/fighters/:id" element={<FighterProfilePage />} />
        <Route path="/ufc/fighters/stats" element={<FighterStatsPage />} />
        <Route path="/ufc/fighters/skills" element={<FighterDecompositionsPage />} />
        {/* Former path for the same page, kept so existing links and bookmarks survive
            the rename from "Rankings"/"Decompositions" to "Fighter Skills". */}
        <Route path="/ufc/fighters/decompositions" element={<FighterDecompositionsPage />} />
      </Routes>
    </Layout>
  )
}
