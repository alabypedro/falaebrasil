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

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Redefina sua senha no Falaê Brasil!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src="https://teastozdtgoogrpghpzj.supabase.co/storage/v1/object/public/avatars/email-assets/falae-brasil-logo.png"
          alt="Falaê Brasil!"
          width="80"
          height="80"
          style={logo}
        />
        <Heading style={h1}>Redefinir sua senha 🔒</Heading>
        <Text style={text}>
          Recebemos um pedido para redefinir a senha da sua conta no
          <strong> Falaê Brasil!</strong> Clique no botão abaixo para criar
          uma nova senha.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Redefinir minha senha
        </Button>
        <Text style={footer}>
          Se você não solicitou a redefinição, pode ignorar este e-mail com
          tranquilidade — sua senha continuará a mesma.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

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
