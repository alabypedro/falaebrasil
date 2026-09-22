/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body,
  Column,
  Container,
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

interface Item {
  label: string
  value: string
}

interface Props {
  studentName?: string
  dateLabel?: string
  level?: string
  planTier?: string
  totalXp?: number
  summary?: Item[]
  courses?: Item[]
  ais?: Item[]
  bst?: Item[]
  books?: Item[]
  recent?: Item[]
}

const Block = ({ title, items }: { title: string; items: Item[] }) =>
  items.length === 0 ? null : (
    <Section style={card}>
      <Text style={cardTitle}>{title}</Text>
      {items.map((it, i) => (
        <Row key={`${it.label}-${i}`} style={metricRow}>
          <Column style={labelCol}>
            <Text style={itemLabel}>{it.label}</Text>
          </Column>
          <Column style={valueCol}>
            <Text style={itemValue}>{it.value}</Text>
          </Column>
        </Row>
      ))}
    </Section>
  )

const StudentProgressEmail = ({
  studentName,
  dateLabel,
  level,
  planTier,
  totalXp,
  summary = [],
  courses = [],
  ais = [],
  bst = [],
  books = [],
  recent = [],
}: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>
      {`Relatório de progresso${studentName ? ` de ${studentName}` : ''}${
        dateLabel ? ` — ${dateLabel}` : ''
      }`}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>FALAÊ BRASIL</Text>
        <Heading style={h1}>Relatório de progresso</Heading>
        <Text style={text}>
          {studentName ? `Olá, ${studentName}! ` : 'Olá! '}
          Este é o resumo da sua evolução na plataforma
          {dateLabel ? ` até ${dateLabel}` : ''}.
        </Text>

        <Section style={scoreBox}>
          <Text style={scoreLabel}>XP TOTAL</Text>
          <Text style={scoreValue}>{(totalXp ?? 0).toLocaleString('pt-BR')}</Text>
          <Text style={scoreHelper}>
            {[level ? `Nível ${level}` : null, planTier ? planTier.toUpperCase() : null]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </Section>

        <Block title="Resumo geral" items={summary} />
        <Block title="Progresso por curso" items={courses} />
        <Block title="As 5 IAs + Cantaê" items={ais} />
        <Block title="IAs do BST" items={bst} />
        <Block title="Estórias Curtas" items={books} />
        <Block title="Atividades recentes" items={recent} />

        <Hr style={hr} />
        <Text style={text}>
          Continue praticando todos os dias — a constância é o que faz o seu inglês
          evoluir:
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
  component: StudentProgressEmail,
  subject: (data: Props) =>
    `Relatório de progresso${data?.studentName ? ` — ${data.studentName}` : ''}`,
  displayName: 'Relatório de progresso do aluno',
  previewData: {
    studentName: 'Adenilson',
    dateLabel: '22/09/2026',
    level: 'B1',
    planTier: 'open',
    totalXp: 11133,
    summary: [
      { label: 'Curso', value: '53% (154/292 vídeos)' },
      { label: 'Média dos quizzes', value: '99%' },
      { label: 'Atividades de IA', value: '331 sessões' },
    ],
    courses: [{ label: 'A1', value: '120/120 · 100%' }],
    ais: [{ label: 'IA Falaê', value: '5548 XP · 296 ativ. · melhor nota 66%' }],
    bst: [{ label: 'IA Falaê BST', value: '0 XP · 0 atividades' }],
    books: [{ label: 'XP de leitura', value: '0 XP' }],
    recent: [{ label: 'IA Falaê · 19/09/2026', value: '+25 XP' }],
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
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.6', margin: '0 0 16px' }
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
  color: '#102A55',
  margin: '0',
}
const scoreHelper = { fontSize: '12px', color: '#7A8699', margin: '6px 0 0' }
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
const labelCol = { width: '58%' }
const valueCol = { width: '42%', textAlign: 'right' as const }
const itemLabel = { fontSize: '13px', color: '#55575d', margin: '0' }
const itemValue = {
  fontSize: '13px',
  fontWeight: 'bold' as const,
  color: '#102A55',
  margin: '0',
}
const hr = { borderColor: '#E4EAF2', margin: '24px 0' }
const link = { color: '#12A8B5', textDecoration: 'underline' }
const footer = { fontSize: '12px', color: '#999999', margin: '20px 0 0' }
