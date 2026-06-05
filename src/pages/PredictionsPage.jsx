import { useEffect, useState } from 'react'
import ModelPerformanceChart from '../components/charts/ModelPerformanceChart'
import OddsComparisonChart from '../components/charts/OddsComparisonChart'
import { Badge } from '../components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { formatDate } from '../lib/utils'

export default function PredictionsPage() {
  const [predictions, setPredictions] = useState([])
  const [modelRuns, setModelRuns] = useState([])
  const [odds, setOdds] = useState([])
  const [sportFilter, setSportFilter] = useState('all')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Predictions</h1>
        <div className="w-40">
          <Select value={sportFilter} onValueChange={setSportFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Sports" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sports</SelectItem>
              <SelectItem value="hockey">Hockey</SelectItem>
              <SelectItem value="lacrosse">Lacrosse</SelectItem>
              <SelectItem value="ufc">UFC</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="predictions">
        <TabsList>
          <TabsTrigger value="predictions">Predictions</TabsTrigger>
          <TabsTrigger value="performance">Model Performance</TabsTrigger>
          <TabsTrigger value="odds">Odds</TabsTrigger>
        </TabsList>

        <TabsContent value="predictions">
          {predictions.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No predictions yet.</p>
          ) : (
            <div className="space-y-3">
              {predictions.map((p) => (
                <Card key={p.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{p.sport}</Badge>
                        <span className="text-sm text-muted-foreground">{p.model_name}</span>
                      </div>
                      <p className="mt-1 font-medium">{p.predicted_outcome}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">{(p.confidence * 100).toFixed(0)}%</div>
                      <div className="text-sm text-muted-foreground">
                        {p.actual_outcome ? `Result: ${p.actual_outcome}` : 'Pending'}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="performance">
          {modelRuns.length > 0 ? (
            <ModelPerformanceChart
              data={modelRuns.map((r) => ({ run_date: formatDate(r.run_date), accuracy: r.accuracy * 100 }))}
            />
          ) : (
            <Card>
              <CardHeader><CardTitle>Model Performance</CardTitle></CardHeader>
              <CardContent><p className="text-muted-foreground">No model runs logged yet.</p></CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="odds">
          {odds.length > 0 ? (
            <OddsComparisonChart
              data={odds.map((o) => ({
                timestamp: formatDate(o.timestamp),
                home_odds: o.home_odds,
                away_odds: o.away_odds,
              }))}
            />
          ) : (
            <Card>
              <CardHeader><CardTitle>Odds Tracking</CardTitle></CardHeader>
              <CardContent><p className="text-muted-foreground">No odds snapshots yet.</p></CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
