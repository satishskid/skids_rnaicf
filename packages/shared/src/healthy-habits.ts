/**
 * Healthy Habits Workshop Data — Content for QR health cards and parent portal.
 * Source: SKIDS clinic workshop programs (fsdev-skids/skids-clinic1)
 *
 * Each workshop has an acronym where every letter teaches a healthy habit.
 * Printed on the back of children's QR health cards.
 */

export interface HabitLetter {
  letter: string
  title: string
  subtitle: string
  description: string
}

export interface HealthyHabitWorkshop {
  id: string
  name: string
  acronym: string
  accessCode: string
  audience: string
  letters: HabitLetter[]
}

export const HEALTHY_HABIT_WORKSHOPS: HealthyHabitWorkshop[] = [
  {
    id: 'habits',
    name: 'Healthy Habits',
    acronym: 'H.A.B.I.T.S.',
    accessCode: '',
    audience: 'Parents & Kids',
    letters: [
      { letter: 'H', title: 'Healthy Eating', subtitle: 'Fuel for Body and Brain', description: 'Nutrition building blocks: Omega-3s, Iron, colorful veggies' },
      { letter: 'A', title: 'Active Movement', subtitle: "The Brain's Miracle-Gro", description: 'Boosts BDNF and helps focus through physical activity' },
      { letter: 'B', title: 'Balanced Stress', subtitle: 'Building a Resilient Brain', description: 'Tools like Box Breathing to calm the alarm system' },
      { letter: 'I', title: 'Inner Coaching', subtitle: 'Architecting the Mind', description: 'Growth mindset: changing "I can\'t" to "I can\'t yet"' },
      { letter: 'T', title: 'Timekeepers', subtitle: "Mastering the Body's Clock", description: 'Morning sunlight sets the circadian rhythm' },
      { letter: 'S', title: 'Sufficient Sleep', subtitle: "The Brain's Nightly Recharge", description: 'Brain cleaning and memory storage during sleep' },
    ],
  },
  {
    id: 'fresh',
    name: 'Fueling Potential',
    acronym: 'F.R.E.S.H.',
    accessCode: 'FRESH2024',
    audience: 'Parents',
    letters: [
      { letter: 'F', title: 'Fiber', subtitle: 'The Gut Gardener', description: 'Feed gut bacteria for better brain and body health' },
      { letter: 'R', title: 'Rainbow', subtitle: 'Brain Shield', description: 'Eat colorful fruits and vegetables every day' },
      { letter: 'E', title: 'Energy', subtitle: 'Smart Carbs', description: 'Choose complex carbs for sustained energy' },
      { letter: 'S', title: 'Sugar', subtitle: 'Less than 24g', description: 'Keep added sugar under 24g per day for children' },
      { letter: 'H', title: 'Hydration', subtitle: 'Water First', description: 'Water is the best drink for growing bodies' },
    ],
  },
  {
    id: 'smart',
    name: 'Screen Smart',
    acronym: 'S.M.A.R.T.',
    accessCode: 'FOCUS2024',
    audience: 'Parents',
    letters: [
      { letter: 'S', title: 'Sleep Sanctuary', subtitle: 'The Glymphatic System', description: 'No screens before bed; blue light suppresses melatonin' },
      { letter: 'M', title: 'Move First', subtitle: 'Natural Dopamine', description: 'BDNF release via physical movement before screen time' },
      { letter: 'A', title: 'Ask Why', subtitle: 'Metacognition', description: 'Switch brain from passive to active intention with screens' },
      { letter: 'R', title: 'Real Connection', subtitle: 'Limbic Resonance', description: 'Empathy requires eye contact, not screens' },
      { letter: 'T', title: 'Turn Off Pings', subtitle: 'Cognitive Cost', description: 'Notifications fragment focus; silence when studying' },
    ],
  },
  {
    id: 'abcde',
    name: 'DigiParenting',
    acronym: 'A.B.C.D.E.',
    accessCode: 'DIGI2024',
    audience: 'Parents',
    letters: [
      { letter: 'A', title: 'Acknowledge', subtitle: 'The Emotional Anchor', description: 'Validate feelings first, don\'t rush to fix' },
      { letter: 'B', title: 'Brainstorm', subtitle: 'The Innovation Lab', description: 'Generate 3 solutions together with your child' },
      { letter: 'C', title: 'Choose', subtitle: 'The Treaty', description: 'Make it a trial, not a law; agree together' },
      { letter: 'D', title: 'Do It', subtitle: 'The Experiment', description: 'No nagging; let the agreed system work' },
      { letter: 'E', title: 'Evaluate', subtitle: 'The Debrief', description: 'If it failed, blame the plan, not the teen' },
    ],
  },
  {
    id: 'abcd',
    name: 'Life Lab',
    acronym: 'A.B.C.D.',
    accessCode: 'LIFE2025',
    audience: 'Students (Grades 6-12)',
    letters: [
      { letter: 'A', title: 'Neuroplasticity', subtitle: 'Forest Paths', description: 'Your brain can grow new connections at any age' },
      { letter: 'B', title: 'The Autopilot', subtitle: 'The Habit Loop', description: 'Brain offloads repeated actions to save energy' },
      { letter: 'C', title: 'Cognitive Reappraisal', subtitle: 'The Storyteller', description: 'Train your brain to fact-check its own narratives' },
      { letter: 'D', title: 'Integrity', subtitle: 'The Mirror Test', description: 'Values-based decisions build lasting character' },
    ],
  },
  {
    id: 'fire',
    name: 'Innovation Engine',
    acronym: 'F.I.R.E.',
    accessCode: 'FUTURE2025',
    audience: 'Students (Grades 6-12)',
    letters: [
      { letter: 'F', title: 'Finding Flow', subtitle: 'The Zone', description: 'Peak performance when challenge matches skill' },
      { letter: 'I', title: 'The Failure Resume', subtitle: 'Bounce Back', description: 'Every failure is a learning data point' },
      { letter: 'R', title: 'The Remix', subtitle: 'Divergent Thinking', description: 'Combine ideas from different sources creatively' },
      { letter: 'E', title: 'Gardener vs Factory', subtitle: 'Connecting Dots', description: 'Nurture ideas like a garden, not an assembly line' },
    ],
  },
]

/** Get a random workshop suitable for a card back (parent-appropriate ones) */
export function getRandomParentWorkshop(): HealthyHabitWorkshop {
  const parentWorkshops = HEALTHY_HABIT_WORKSHOPS.filter(
    w => w.audience.includes('Parent') || w.audience.includes('Kids')
  )
  return parentWorkshops[Math.floor(Math.random() * parentWorkshops.length)]
}

/** Get workshop by ID */
export function getWorkshopById(id: string): HealthyHabitWorkshop | undefined {
  return HEALTHY_HABIT_WORKSHOPS.find(w => w.id === id)
}
