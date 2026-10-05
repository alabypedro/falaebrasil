import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'

interface Item { name: string; reason: string; priority: string; overdue: boolean }
interface Props { recipientName?: string; dateLabel?: string; today?: number; overdue?: number; items?: Item[]; link?: string }

function RelationshipDailySummary({ recipientName, dateLabel, today = 0, overdue = 0, items = [], link }: Props) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{`${today} tarefa(s) hoje · ${overdue} atrasada(s)`}</Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }}>
        <Container style={{ padding: '24px', maxWidth: '560px' }}>
          <Heading style={{ fontSize: '20px', color: '#0f172a' }}>Resumo de Relacionamento — {dateLabel}</Heading>
          <Text style={{ color: '#334155' }}>Oi{recipientName ? `, ${recipientName}` : ''}! Estas são as tarefas de contato para hoje.</Text>
          <Section style={{ backgroundColor: '#f1f5f9', borderRadius: '8px', padding: '12px 16px' }}>
            <Text style={{ margin: 0, color: '#0f172a' }}><strong>Tarefas de hoje:</strong> {today}</Text>
            <Text style={{ margin: 0, color: overdue > 0 ? '#b91c1c' : '#0f172a' }}><strong>Atrasadas:</strong> {overdue}</Text>
          </Section>
          {items.length > 0 && (
            <Section style={{ marginTop: '16px' }}>
              <Text style={{ fontWeight: 'bold', color: '#0f172a' }}>Clientes prioritários</Text>
              {items.map((it, i) => (
                <Text key={i} style={{ margin: '4px 0', color: '#334155' }}>
                  • {it.name} — {it.reason} ({it.priority}{it.overdue ? ', atrasada' : ''})
                </Text>
              ))}
            </Section>
          )}
          {link && (
            <Button href={link} style={{ marginTop: '20px', backgroundColor: '#0f172a', color: '#ffffff', padding: '10px 18px', borderRadius: '6px' }}>
              Abrir Relacionamento
            </Button>
          )}
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: RelationshipDailySummary,
  subject: (d: Props) => `Relacionamento: ${d.today ?? 0} hoje · ${d.overdue ?? 0} atrasada(s)`,
  displayName: 'Resumo diário de relacionamento',
  previewData: { recipientName: 'Rosana', dateLabel: '05/10/2026', today: 3, overdue: 1, items: [{ name: 'Maria S.', reason: 'Cliente respondeu mensagem', priority: 'alta', overdue: false }], link: 'https://app.falaebrasil.com.br/admin/relationship' },
}
