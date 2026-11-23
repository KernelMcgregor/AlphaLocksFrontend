import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/layout/Layout'
import ArticlesPage from './pages/ArticlesPage'
import FightDetailPage from './pages/FightDetailPage'
import FightPreviewPage from './pages/FightPreviewPage'
import NewsStoryPage from './pages/NewsStoryPage'
import FighterDecompositionsPage from './pages/FighterDecompositionsPage'
import FighterProfilePage from './pages/FighterProfilePage'
import FighterStatsPage from './pages/FighterStatsPage'
import FighterStylesPage from './pages/FighterStylesPage'
import HypotheticalPage from './pages/HypotheticalPage'
import RankingsPage from './pages/RankingsPage'
import PicksPage from './pages/PicksPage'
import PastResultsPage from './pages/PastResultsPage'
import HomePage from './pages/HomePage'
import UFCPage from './pages/UFCPage'
import UpcomingPage from './pages/UpcomingPage'
import JudgeProfilePage from './pages/JudgeProfilePage'
import HighlightsPage from './pages/HighlightsPage'
import OfficialsPage from './pages/OfficialsPage'
import RefereeProfilePage from './pages/RefereeProfilePage'

export default function App() {
  return (
    <Layout>
      <Routes>
        {/* The home dashboard: where the logo leads. Not in the sidebar. */}
        <Route path="/" element={<HomePage />} />
        <Route path="/ufc" element={<Navigate to="/" replace />} />
        <Route path="/ufc/events" element={<UFCPage />} />
        <Route path="/ufc/articles" element={<ArticlesPage />} />
        <Route path="/ufc/fights/:id" element={<FightDetailPage />} />
        <Route path="/ufc/fights/:id/preview" element={<FightPreviewPage />} />
        <Route path="/ufc/news/:slug" element={<NewsStoryPage />} />
        <Route path="/ufc/rankings" element={<RankingsPage />} />
        {/* P4P and BMF are boards inside the Rankings page, chosen in its division picker. */}
        <Route path="/ufc/rankings/bmf" element={<Navigate to="/ufc/rankings?div=bmf_men" replace />} />
        <Route path="/ufc/rankings/p4p" element={<Navigate to="/ufc/rankings?div=p4p_men" replace />} />
        <Route path="/ufc/rankings/timelapse" element={<Navigate to="/ufc/rankings?view=history" replace />} />
        {/* Judges and referees share one page; their profiles keep their own URLs. */}
        <Route path="/ufc/officials" element={<OfficialsPage />} />
        <Route path="/ufc/highlights" element={<HighlightsPage />} />
        <Route path="/ufc/best" element={<Navigate to="/ufc/highlights" replace />} />
        <Route path="/ufc/judges" element={<Navigate to="/ufc/officials" replace />} />
        <Route path="/ufc/judges/:id" element={<JudgeProfilePage />} />
        <Route path="/ufc/referees" element={<Navigate to="/ufc/officials?view=referees" replace />} />
        <Route path="/ufc/referees/:id" element={<RefereeProfilePage />} />
        <Route path="/model/upcoming" element={<UpcomingPage />} />
        <Route path="/ufc/hypothetical" element={<HypotheticalPage />} />
        {/* The breakdown used to be its own page; it is the matchup view now. */}
        <Route path="/ufc/hypothetical/breakdown" element={<HypotheticalPage />} />
        <Route path="/picks" element={<PicksPage />} />
        <Route path="/results" element={<PastResultsPage />} />
        <Route path="/ufc/fighters/:id" element={<FighterProfilePage />} />
        <Route path="/ufc/fighters/stats" element={<FighterStatsPage />} />
        <Route path="/ufc/fighters/skills" element={<FighterDecompositionsPage />} />
        <Route path="/ufc/fighters/styles" element={<FighterStylesPage />} />
        {/* Former path for the same page, kept so existing links and bookmarks survive
            the rename from "Rankings"/"Decompositions" to "Fighter Skills". */}
        <Route path="/ufc/fighters/decompositions" element={<FighterDecompositionsPage />} />
      </Routes>
    </Layout>
  )
}
