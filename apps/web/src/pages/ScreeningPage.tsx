/**
 * ScreeningPage — Campaign screening hub.
 * Shows child list for a campaign with module grid per child.
 * Route: /screen/:code
 */
import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { apiCall } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Child {
  id: string
  name: string
  gender?: string
  dob?: string
  class?: string
}

const MODULES = [
  'general_appearance', 'height', 'weight', 'vitals', 'vision',
  'hearing', 'dental', 'skin', 'eyes_external', 'ear', 'nose',
  'throat', 'neck', 'respiratory', 'cardiac', 'pulmonary',
  'abdomen', 'lymph', 'posture', 'motor', 'neuro',
  'hair', 'nails', 'hemoglobin', 'spo2', 'bp', 'muac',
  'immunization', 'nutrition_intake', 'intervention',
]

export default function ScreeningPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const [children, setChildren] = useState<Child[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!code) return
    apiCall<{ children: Child[] }>(`/api/children?campaign=${code}`)
      .then(data => setChildren(data.children || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [code])

  if (loading) return <div className="p-8 text-center">Loading children...</div>

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Screening — {code}</h1>
      <p className="text-muted-foreground">{children.length} children enrolled</p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {children.map(child => (
          <Card key={child.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{child.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {child.gender} {child.class ? `| Class ${child.class}` : ''}
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {MODULES.slice(0, 10).map(mod => (
                  <Button
                    key={mod}
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/screen/${code}/${child.id}/${mod}`)}
                  >
                    {mod.replace(/_/g, ' ')}
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/screen/${code}/${child.id}/general_appearance`)}
                >
                  All modules →
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
