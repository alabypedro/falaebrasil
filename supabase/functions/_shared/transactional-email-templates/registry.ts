import type { ComponentType } from 'npm:react@18.3.1'
import { template as evaluationReport } from './evaluation-report.tsx'
import { template as studentProgressReport } from './student-progress-report.tsx'
import { template as relationshipDailySummary } from './relationship-daily-summary.tsx'

export interface TemplateEntry {
  // deno-lint-ignore no-explicit-any
  component: ComponentType<any>
  // deno-lint-ignore no-explicit-any
  subject: string | ((data: any) => string)
  displayName?: string
  // deno-lint-ignore no-explicit-any
  previewData?: Record<string, any>
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'evaluation-report': evaluationReport,
  'student-progress-report': studentProgressReport,
  'relationship-daily-summary': relationshipDailySummary,
}
