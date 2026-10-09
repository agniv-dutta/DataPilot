export const APP_NAME = 'DataPilot'
export const APP_TAGLINE = 'Ask your spreadsheets anything'

/** Ordered chart palette (fallback; live values come from CSS vars). */
export const CHART_PALETTE = [
  '#5B3DF5',
  '#FF6B4A',
  '#C65BCF',
  '#8EA2FF',
  '#8A1F5C',
  '#FF9E85',
  '#3B2A8C',
  '#D9A6F2',
] as const

export interface StarterQuestion {
  question: string
  description: string
  icon: 'trend' | 'map' | 'users' | 'alert'
}

export const STARTER_QUESTIONS: StarterQuestion[] = [
  {
    question: 'Which region generated the highest revenue?',
    description: 'Group by region, rank totals',
    icon: 'map',
  },
  {
    question: 'Show the monthly revenue trend as a line chart',
    description: 'Time series over the last year',
    icon: 'trend',
  },
  {
    question: 'Who are the top 5 customers by revenue?',
    description: 'Rank customers and totals',
    icon: 'users',
  },
  {
    question: 'Detect anomalies in revenue',
    description: 'Flag unusual spikes and dips',
    icon: 'alert',
  },
]

export const SAMPLE_QUESTIONS = [
  'Which region generated the highest revenue?',
  'Show the monthly revenue trend as a line chart',
  'Who are the top 5 customers by revenue?',
  'Detect anomalies in revenue',
  'Break revenue down by product category',
  'What is the average order value by month?',
  'Compare sales across regions over time',
  'Are there duplicate rows in the data?',
]

export const SAMPLE_DATASETS = [
  { name: 'sales.csv', description: '2,000 rows — regions, products, revenue', kind: 'sales' },
  { name: 'customers.csv', description: '80 customers with tiers', kind: 'customers' },
  { name: 'products.csv', description: 'Product catalog and margins', kind: 'products' },
] as const
