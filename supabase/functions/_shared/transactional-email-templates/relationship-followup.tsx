import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from 'npm:@react-email/components@0.0.22'

interface Props { name?: string; heading?: string; message?: string; link?: string }

function RelationshipFollowup({ name, heading, message, link }: Props) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{message ?? 'Seu acesso no Falaê Brasil!'}</Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }}>
        <Container style={{ padding: '24px', maxWidth: '560px' }}>
          <Heading style={{ fontSize: '20px', color: '#0f172a' }}>{heading ?? 'Falaê Brasil!'}</Heading>
          <Text style={{ color: '#334155', fontSize: '15px', lineHeight: '24px' }}>{name ? `Oi, ${name}.` : 'Oi!'}</Text>
          <Text style={{ color: '#334155', fontSize: '15px', lineHeight: '24px' }}>{message}</Text>
          {link && (
            <Button href={link} style={{ marginTop: '12px', backgroundColor: '#0f172a', color: '#ffffff', padding: '10px 18px', borderRadius: '6px' }}>
              Abrir meu produto
            </Button>
          )}
          <Text style={{ color: '#64748b', fontSize: '13px', marginTop: '24px' }}>Equipe Falaê Brasil!</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: RelationshipFollowup,
  subject: (d: Props) => d.heading ?? 'Falaê Brasil!',
  displayName: 'Acompanhamento do cliente (D0, D+1, D+3)',
  previewData: { name: 'Clóvis', heading: 'Seu acesso já está liberado', message: 'Comece pelo primeiro bloco e use as frases como ferramenta, não como matéria para decorar.', link: 'https://app.falaebrasil.com.br/library' },
}
