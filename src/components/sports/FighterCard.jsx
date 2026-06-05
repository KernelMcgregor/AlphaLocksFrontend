import CountryFlag from '../CountryFlag'
import { Badge } from '../ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'

export default function FighterCard({ fighter }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-1.5">
            <CountryFlag countryCode={fighter.country_code} />
            {fighter.name}
          </CardTitle>
          {fighter.weight_class && <Badge variant="secondary">{fighter.weight_class}</Badge>}
        </div>
        {fighter.nickname && (
          <p className="text-sm text-muted-foreground">"{fighter.nickname}"</p>
        )}
      </CardHeader>
      <CardContent />
    </Card>
  )
}
