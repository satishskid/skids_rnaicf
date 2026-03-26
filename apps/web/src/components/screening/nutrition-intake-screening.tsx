
import React, { useState } from 'react'
import { ScreeningProps } from './types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Icons } from '@/components/icons'

// ── Region-based nutrition chips ──────────────────

interface NutritionChip {
  id: string
  label: string
  category: 'school' | 'home'
  group?: string
}

const NUTRITION_CHIPS_BY_REGION: Record<string, NutritionChip[]> = {
  IN: [
    // School nutrition chips (India)
    { id: 'ni_in_s1', label: 'Rice & Dal', category: 'school', group: 'MDM Staples' },
    { id: 'ni_in_s2', label: 'Roti & Sabzi', category: 'school', group: 'MDM Staples' },
    { id: 'ni_in_s3', label: 'Khichdi', category: 'school', group: 'MDM Staples' },
    { id: 'ni_in_s4', label: 'Egg (PMPOSHAN)', category: 'school', group: 'Protein' },
    { id: 'ni_in_s5', label: 'Milk / Lassi', category: 'school', group: 'Dairy' },
    { id: 'ni_in_s6', label: 'Fruit', category: 'school', group: 'Micronutrient' },
    { id: 'ni_in_s7', label: 'Fortified Rice', category: 'school', group: 'Fortified' },
    { id: 'ni_in_s8', label: 'Soy Chunks', category: 'school', group: 'Protein' },
    { id: 'ni_in_s9', label: 'Jaggery / Chikki', category: 'school', group: 'Iron-rich' },
    // Home nutrition chips (India)
    { id: 'ni_in_h1', label: 'Dal / Pulses', category: 'home', group: 'Protein' },
    { id: 'ni_in_h2', label: 'Rice / Roti', category: 'home', group: 'Carbs' },
    { id: 'ni_in_h3', label: 'Green Leafy Vegetables', category: 'home', group: 'Micronutrient' },
    { id: 'ni_in_h4', label: 'Milk / Curd', category: 'home', group: 'Dairy' },
    { id: 'ni_in_h5', label: 'Egg', category: 'home', group: 'Protein' },
    { id: 'ni_in_h6', label: 'Meat / Fish', category: 'home', group: 'Protein' },
    { id: 'ni_in_h7', label: 'Iron-rich (Ragi/Bajra)', category: 'home', group: 'Micronutrient' },
    { id: 'ni_in_h8', label: 'Junk / Packaged Food', category: 'home', group: 'Risk' },
    { id: 'ni_in_h9', label: 'Tea (tannin - inhibits iron)', category: 'home', group: 'Risk' },
    { id: 'ni_in_h10', label: 'Skips Breakfast', category: 'home', group: 'Risk' },
  ],
  AE: [
    { id: 'ni_ae_s1', label: 'Arabic Bread & Hummus', category: 'school', group: 'Staple' },
    { id: 'ni_ae_s2', label: 'Rice & Chicken', category: 'school', group: 'Protein' },
    { id: 'ni_ae_s3', label: 'Lentil Soup', category: 'school', group: 'Protein' },
    { id: 'ni_ae_s4', label: 'Fresh Juice', category: 'school', group: 'Micronutrient' },
    { id: 'ni_ae_s5', label: 'Yoghurt', category: 'school', group: 'Dairy' },
    { id: 'ni_ae_s6', label: 'Dates', category: 'school', group: 'Iron-rich' },
    { id: 'ni_ae_h1', label: 'Rice & Meat', category: 'home', group: 'Protein' },
    { id: 'ni_ae_h2', label: 'Bread & Cheese', category: 'home', group: 'Dairy' },
    { id: 'ni_ae_h3', label: 'Fish', category: 'home', group: 'Protein' },
    { id: 'ni_ae_h4', label: 'Fresh Vegetables', category: 'home', group: 'Micronutrient' },
    { id: 'ni_ae_h5', label: 'Fast Food', category: 'home', group: 'Risk' },
    { id: 'ni_ae_h6', label: 'Sugary Drinks', category: 'home', group: 'Risk' },
    { id: 'ni_ae_h7', label: 'Traditional Stew', category: 'home', group: 'Protein' },
  ],
  default: [
    { id: 'ni_df_s1', label: 'Rice / Grain', category: 'school', group: 'Carbs' },
    { id: 'ni_df_s2', label: 'Protein (egg/meat/bean)', category: 'school', group: 'Protein' },
    { id: 'ni_df_s3', label: 'Vegetables', category: 'school', group: 'Micronutrient' },
    { id: 'ni_df_s4', label: 'Dairy (milk/yogurt)', category: 'school', group: 'Dairy' },
    { id: 'ni_df_s5', label: 'Fruit', category: 'school', group: 'Micronutrient' },
    { id: 'ni_df_s6', label: 'Fortified Food', category: 'school', group: 'Fortified' },
    { id: 'ni_df_h1', label: 'Grains', category: 'home', group: 'Carbs' },
    { id: 'ni_df_h2', label: 'Protein', category: 'home', group: 'Protein' },
    { id: 'ni_df_h3', label: 'Vegetables', category: 'home', group: 'Micronutrient' },
    { id: 'ni_df_h4', label: 'Dairy', category: 'home', group: 'Dairy' },
    { id: 'ni_df_h5', label: 'Fruit', category: 'home', group: 'Micronutrient' },
    { id: 'ni_df_h6', label: 'Processed / Packaged', category: 'home', group: 'Risk' },
    { id: 'ni_df_h7', label: 'Sugary Drinks', category: 'home', group: 'Risk' },
  ],
}

// Use same chips for SA, QA, KW, BH, OM as AE (Gulf region)
for (const code of ['SA', 'QA', 'KW', 'BH', 'OM']) {
  NUTRITION_CHIPS_BY_REGION[code] = NUTRITION_CHIPS_BY_REGION['AE']
}

function getChipsForRegion(regionCode: string): NutritionChip[] {
  return NUTRITION_CHIPS_BY_REGION[regionCode] || NUTRITION_CHIPS_BY_REGION['default']
}

// ── Component ──────────────────────────────────

interface NutritionIntakeScreeningProps extends ScreeningProps {
  regionCode?: string
}

export function NutritionIntakeScreening({
  step, setStep, onComplete, instructions, childName, regionCode = 'IN',
}: NutritionIntakeScreeningProps) {
  // Form state
  const [schoolMealType, setSchoolMealType] = useState('mid_day_meal')
  const [schoolFrequency, setSchoolFrequency] = useState('daily')
  const [mealsPerDay, setMealsPerDay] = useState('3')
  const [dietType, setDietType] = useState('vegetarian')
  const [selectedChips, setSelectedChips] = useState<string[]>([])
  const [notes, setNotes] = useState('')

  const chips = getChipsForRegion(regionCode)
  const schoolChips = chips.filter(c => c.category === 'school')
  const homeChips = chips.filter(c => c.category === 'home')

  const toggleChip = (chipId: string) => {
    setSelectedChips(prev =>
      prev.includes(chipId) ? prev.filter(id => id !== chipId) : [...prev, chipId]
    )
  }

  const riskChips = selectedChips.filter(id => {
    const chip = chips.find(c => c.id === id)
    return chip?.group === 'Risk'
  })

  if (step === 0) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle>{instructions.title}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Alert><Icons.Info className="w-4 h-4" /><AlertTitle>Nutrition Intake for {childName}</AlertTitle>
            <AlertDescription>
              <p className="text-sm mt-1">Capture what the child eats at school and at home. Select all food items that apply.</p>
            </AlertDescription></Alert>
          <Button className="w-full" onClick={() => setStep(1)}>Start Assessment</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          Nutrition Intake
          <Badge variant="outline" className="text-xs font-normal">{childName}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* ── Section 1: School Nutrition ── */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-slate-700 flex items-center gap-2">
            <Icons.Building className="w-4 h-4" />
            School Nutrition
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Meal Source</Label>
              <Select value={schoolMealType} onValueChange={setSchoolMealType}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mid_day_meal">Mid-Day Meal (MDM)</SelectItem>
                  <SelectItem value="packed_lunch">Packed from Home</SelectItem>
                  <SelectItem value="school_canteen">School Canteen</SelectItem>
                  <SelectItem value="none">No School Meal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Frequency</Label>
              <Select value={schoolFrequency} onValueChange={setSchoolFrequency}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="3_4_days">3-4 days/week</SelectItem>
                  <SelectItem value="1_2_days">1-2 days/week</SelectItem>
                  <SelectItem value="rarely">Rarely / Never</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {schoolChips.map(chip => (
              <Badge
                key={chip.id}
                variant={selectedChips.includes(chip.id) ? 'default' : 'outline'}
                className={`cursor-pointer text-xs transition-colors ${
                  selectedChips.includes(chip.id)
                    ? chip.group === 'Risk' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'
                    : 'hover:bg-gray-100'
                }`}
                onClick={() => toggleChip(chip.id)}
              >
                {chip.label}
              </Badge>
            ))}
          </div>
        </div>

        <Separator />

        {/* ── Section 2: Home / Outside Nutrition ── */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-slate-700 flex items-center gap-2">
            <Icons.Home className="w-4 h-4" />
            Home / Outside-School Nutrition
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Meals per Day</Label>
              <Input
                type="number"
                min={1}
                max={6}
                value={mealsPerDay}
                onChange={e => setMealsPerDay(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Diet Type</Label>
              <Select value={dietType} onValueChange={setDietType}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vegetarian">Vegetarian</SelectItem>
                  <SelectItem value="non_vegetarian">Non-Vegetarian</SelectItem>
                  <SelectItem value="vegan">Vegan</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {homeChips.map(chip => (
              <Badge
                key={chip.id}
                variant={selectedChips.includes(chip.id) ? 'default' : 'outline'}
                className={`cursor-pointer text-xs transition-colors ${
                  selectedChips.includes(chip.id)
                    ? chip.group === 'Risk' ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'
                    : 'hover:bg-gray-100'
                }`}
                onClick={() => toggleChip(chip.id)}
              >
                {chip.label}
              </Badge>
            ))}
          </div>
        </div>

        <Separator />

        {/* Risk summary */}
        {riskChips.length > 0 && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertDescription className="text-amber-800 text-sm">
              <strong>{riskChips.length} risk factor{riskChips.length > 1 ? 's' : ''}</strong> identified:
              {' '}{riskChips.map(id => chips.find(c => c.id === id)?.label).join(', ')}
            </AlertDescription>
          </Alert>
        )}

        {/* Notes */}
        <div>
          <Label className="text-xs">Notes (optional)</Label>
          <Textarea
            rows={2}
            placeholder="e.g., child skips breakfast, only eats MDM at school..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="mt-1 text-sm"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStep(0)} className="flex-1">
            <Icons.ArrowLeft className="w-4 h-4 mr-1" />Back
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              const riskCategory = riskChips.length >= 2 ? 'high_risk' : riskChips.length === 1 ? 'possible_risk' : 'no_risk'
              // Build severity map for risk chips
              const chipSeverities: Record<string, string> = {}
              for (const chipId of riskChips) {
                chipSeverities[chipId] = 'moderate'
              }
              onComplete({
                moduleType: 'nutrition_intake',
                schoolMealType,
                schoolFrequency,
                mealsPerDay: parseInt(mealsPerDay) || 3,
                dietType,
                regionCode,
                selectedChips,
                notes,
                riskCategory,
                summaryText: `Diet: ${dietType}, School: ${schoolMealType} (${schoolFrequency}), ${selectedChips.length} items selected`,
                annotationData: {
                  selectedChips,
                  chipSeverities,
                },
              })
            }}
          >
            Save Assessment
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
