/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Column,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Metric {
  label: string
  value: number
}

interface EvaluationSection {
  title: string
  lines: string[]
}

interface Props {
  studentName?: string
  toolLabel?: string
  dateLabel?: string
  overallScore?: number | null
  metrics?: Metric[]
  transcription?: string
  sections?: EvaluationSection[]
  pdfUrl?: string
}

function scoreColor(score: number) {
  if (score >= 80) return '#16A34A'
  if (score >= 60) return '#CA8A04'
  if (score >= 40) return '#EA580C'
  return '#DC2626'
}

const EvaluationReportEmail = ({
  studentName,
  toolLabel = 'Avaliação de IA',
  dateLabel,
  overallScore,
  metrics = [],
  transcription,
  sections = [],
  pdfUrl,
}: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>
      {`Seu resultado em ${toolLabel}${
        typeof overallScore === 'number' ? ` — ${overallScore}/100` : ''
      }`}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>FALAÊ BRASIL</Text>
        <Heading style={h1}>Resultado da sua avaliação</Heading>
        <Text style={text}>
          {studentName ? `Olá, ${studentName}! ` : 'Olá! '}
          Aqui está o relatório completo da sua prática em{' '}
          <strong style={strong}>{toolLabel}</strong>
          {dateLabel ? ` realizada em ${dateLabel}` : ''}.
        </Text>

        {typeof overallScore === 'number' && (
          <Section style={scoreBox}>
            <Text style={scoreLabel}>PONTUAÇÃO GERAL</Text>
            <Text style={{ ...scoreValue, color: scoreColor(overallScore) }}>
              {overallScore}/100
            </Text>
          </Section>
        )}

        {metrics.length > 0 && (
          <Section style={card}>
            <Text style={cardTitle}>Notas por critério</Text>
            {metrics.map((m) => (
              <Row key={m.label} style={metricRow}>
                <Column style={metricLabelCol}>
                  <Text style={metricLabel}>{m.label}</Text>
                </Column>
                <Column style={metricValueCol}>
                  <Text style={{ ...metricValue, color: scoreColor(m.value) }}>
                    {m.value}
                  </Text>
                </Column>
              </Row>
            ))}
          </Section>
        )}

        {transcription && (
          <Section style={card}>
            <Text style={cardTitle}>Texto reconhecido</Text>
            <Text style={quote}>“{transcription}”</Text>
          </Section>
        )}

        {sections.map((s) => (
          <Section key={s.title} style={card}>
            <Text style={cardTitle}>{s.title}</Text>
            {s.lines.map((line, i) => (
              <Text key={i} style={bullet}>
                • {line}
              </Text>
            ))}
          </Section>
        ))}

        {pdfUrl && (
          <Section style={pdfBox}>
            <Text style={cardTitle}>Avaliação completa em PDF</Text>
            <Text style={{ ...text, margin: '0 0 14px' }}>
              Geramos um documento com o relatório completo desta prática para
              você guardar, imprimir ou compartilhar com seu professor.
            </Text>
            <Button href={pdfUrl} style={pdfButton}>
              Baixar avaliação em PDF
            </Button>
          </Section>
        )}

        <Hr style={hr} />
        <Text style={text}>
          Continue praticando todos os dias — a constância é o que faz o seu
          inglês evoluir. Acesse a plataforma e faça uma nova prática agora:
        </Text>
        <Text style={text}>
          <Link href="https://app.falaebrasil.com.br" style={link}>
            app.falaebrasil.com.br
          </Link>
        </Text>
        <Text style={footer}>
          Dúvidas? Fale com a gente:{' '}
          <Link href="mailto:atendimento@falaebrasil.com.br" style={link}>
            atendimento@falaebrasil.com.br
          </Link>
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: EvaluationReportEmail,
  subject: (data: Props) =>
    `Seu resultado em ${data?.toolLabel ?? 'IA Falaê Brasil'}${
      typeof data?.overallScore === 'number' ? ` — ${data.overallScore}/100` : ''
    }`,
  displayName: 'Resultado da avaliação de IA',
  previewData: {
    studentName: 'João',
    toolLabel: 'IA Falaê — Scripted',
    dateLabel: '04/08/2026',
    overallScore: 86,
    metrics: [
      { label: 'Pronúncia', value: 91 },
      { label: 'Fluência', value: 100 },
      { label: 'Completude', value: 100 },
      { label: 'Prosódia', value: 80 },
      { label: 'PronScore', value: 86 },
    ],
    transcription: 'There she goes, she goes, she goes.',
    sections: [
      {
        title: 'Sugestões de melhoria (IA)',
        lines: [
          'Sua pronúncia foi excelente, com 91 de acurácia.',
          'Trabalhe a entonação para elevar a prosódia acima de 90.',
        ],
      },
    ],
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily: 'Inter, -apple-system, "Segoe UI", Arial, sans-serif',
}
const container = { padding: '24px 24px 40px', maxWidth: '600px' }
const brand = {
  fontSize: '11px',
  letterSpacing: '2px',
  fontWeight: 'bold' as const,
  color: '#12A8B5',
  margin: '0 0 8px',
}
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#102A55',
  margin: '0 0 16px',
}
const text = {
  fontSize: '14px',
  color: '#55575d',
  lineHeight: '1.6',
  margin: '0 0 16px',
}
const strong = { color: '#102A55' }
const scoreBox = {
  backgroundColor: '#F1F6FB',
  borderRadius: '14px',
  padding: '18px 20px',
  textAlign: 'center' as const,
  margin: '0 0 18px',
}
const scoreLabel = {
  fontSize: '10px',
  letterSpacing: '1.5px',
  fontWeight: 'bold' as const,
  color: '#7A8699',
  margin: '0 0 6px',
}
const scoreValue = {
  fontSize: '32px',
  fontWeight: 'bold' as const,
  margin: '0',
}
const card = {
  border: '1px solid #E4EAF2',
  borderRadius: '14px',
  padding: '16px 18px',
  margin: '0 0 14px',
}
const cardTitle = {
  fontSize: '11px',
  letterSpacing: '1px',
  textTransform: 'uppercase' as const,
  fontWeight: 'bold' as const,
  color: '#102A55',
  margin: '0 0 12px',
}
const metricRow = { margin: '0 0 6px' }
const metricLabelCol = { width: '70%' }
const metricValueCol = { width: '30%', textAlign: 'right' as const }
const metricLabel = { fontSize: '13px', color: '#55575d', margin: '0' }
const metricValue = {
  fontSize: '15px',
  fontWeight: 'bold' as const,
  margin: '0',
}
const quote = {
  fontSize: '14px',
  fontStyle: 'italic' as const,
  color: '#102A55',
  margin: '0',
  lineHeight: '1.6',
}
const bullet = {
  fontSize: '13px',
  color: '#55575d',
  lineHeight: '1.6',
  margin: '0 0 8px',
}
const hr = { borderColor: '#E4EAF2', margin: '24px 0' }
const link = { color: '#12A8B5', textDecoration: 'underline' }
const footer = { fontSize: '12px', color: '#999999', margin: '20px 0 0' }