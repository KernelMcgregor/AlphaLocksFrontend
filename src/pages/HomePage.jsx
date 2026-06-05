import { BarChart3, Database, Swords, TrendingUp, Users, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'

function StatCard({ icon: Icon, label, value, description }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  )
}

export default function HomePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">ALocks</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Sports betting analytics, predictions, and model tracking.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Fighters" value="4,496" description="UFC fighter profiles" />
        <StatCard icon={Database} label="Events" value="1,251" description="Historical events scraped" />
        <StatCard icon={Swords} label="Fights" value="11,333" description="With full stats" />
        <StatCard icon={BarChart3} label="Stats Rows" value="71,820" description="Per-round breakdowns" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="hover:border-primary/30 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Swords className="h-5 w-5 text-primary" />
              UFC Analysis
            </CardTitle>
            <CardDescription>Browse events, fights, and fighter stats from UFCStats.com</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              to="/ufc"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Browse events & fights
              <TrendingUp className="h-3.5 w-3.5" />
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/30 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Model Performance
            </CardTitle>
            <CardDescription>
              v5 ensemble: GBT + RNN + GNN + Siamese with ridge meta-learner.
              82% accuracy at 30%+ confidence threshold.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              to="/predictions"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              View predictions
              <TrendingUp className="h-3.5 w-3.5" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
