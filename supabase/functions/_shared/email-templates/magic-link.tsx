/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu link de acesso ao Falaê Brasil!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src="https://teastozdtgoogrpghpzj.supabase.co/storage/v1/object/public/avatars/email-assets/falae-brasil-logo.png"
          alt="Falaê Brasil!"
          width="80"
          height="80"
          style={logo}
        />
        <Heading style={h1}>Seu link de acesso ✨</Heading>
        <Text style={text}>
          Clique no botão abaixo para entrar na sua conta no
          <strong> Falaê Brasil!</strong> Este link expira em alguns minutos.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Entrar agora
        </Button>
        <Text style={footer}>
          Se você não solicitou este link, pode ignorar este e-mail com
          tranquilidade.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily: 'Inter, -apple-system, "Segoe UI", Arial, sans-serif',
}
const container = { padding: '20px 25px' }
const logo = { margin: '0 0 20px', display: 'block' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: 'hsl(222, 65%, 18%)',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#55575d',
  lineHeight: '1.5',
  margin: '0 0 25px',
}
const button = {
  backgroundColor: 'hsl(222, 65%, 18%)',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  borderRadius: '14px',
  padding: '12px 20px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
