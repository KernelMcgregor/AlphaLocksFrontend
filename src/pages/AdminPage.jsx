import { useEffect, useState } from 'react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { fetchAdminStats } from '../lib/api'

export default function AdminPage() {
  const [stats, setStats] = useState(null)
  const [fighterForm, setFighterForm] = useState({ name: '', nickname: '', weight_class: '' })
  const [predForm, setPredForm] = useState({ sport: 'ufc', event_id: 1, model_name: '', predicted_outcome: '', confidence: 0.5 })
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchAdminStats().then(setStats).catch(() => {})
  }, [])

  const handleCreateFighter = async (e) => {
    e.preventDefault()
    setMessage('Not implemented yet — fighters are scraped from UFCStats')
  }

  const handleCreatePrediction = async (e) => {
    e.preventDefault()
    setMessage('Not implemented yet — predictions come from the model pipeline')
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      {message && <p className="rounded bg-muted p-3 text-sm">{message}</p>}

      {stats && (
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(stats).map(([section, counts]) => (
            <Card key={section}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium capitalize">{section}</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.entries(counts).map(([key, val]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{key}</span>
                    <span className="font-semibold">{val}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Tabs defaultValue="fighter">
        <TabsList>
          <TabsTrigger value="fighter">Add Fighter</TabsTrigger>
          <TabsTrigger value="prediction">Add Prediction</TabsTrigger>
        </TabsList>

        <TabsContent value="fighter">
          <Card>
            <CardHeader><CardTitle>Create Fighter</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleCreateFighter} className="space-y-4">
                <input
                  className="w-full rounded border border-border bg-background p-2"
                  placeholder="Name"
                  value={fighterForm.name}
                  onChange={(e) => setFighterForm({ ...fighterForm, name: e.target.value })}
                  required
                />
                <input
                  className="w-full rounded border border-border bg-background p-2"
                  placeholder="Nickname"
                  value={fighterForm.nickname}
                  onChange={(e) => setFighterForm({ ...fighterForm, nickname: e.target.value })}
                />
                <input
                  className="w-full rounded border border-border bg-background p-2"
                  placeholder="Weight class"
                  value={fighterForm.weight_class}
                  onChange={(e) => setFighterForm({ ...fighterForm, weight_class: e.target.value })}
                />
                <Button type="submit">Create Fighter</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prediction">
          <Card>
            <CardHeader><CardTitle>Create Prediction</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleCreatePrediction} className="space-y-4">
                <input
                  className="w-full rounded border border-border bg-background p-2"
                  placeholder="Model name"
                  value={predForm.model_name}
                  onChange={(e) => setPredForm({ ...predForm, model_name: e.target.value })}
                  required
                />
                <input
                  className="w-full rounded border border-border bg-background p-2"
                  placeholder="Predicted outcome"
                  value={predForm.predicted_outcome}
                  onChange={(e) => setPredForm({ ...predForm, predicted_outcome: e.target.value })}
                  required
                />
                <input
                  className="w-full rounded border border-border bg-background p-2"
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  placeholder="Confidence (0-1)"
                  value={predForm.confidence}
                  onChange={(e) => setPredForm({ ...predForm, confidence: parseFloat(e.target.value) })}
                  required
                />
                <Button type="submit">Create Prediction</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
