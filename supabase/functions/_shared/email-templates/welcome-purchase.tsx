/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface WelcomePurchaseEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const WelcomePurchaseEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: WelcomePurchaseEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seja bem-vindo ao Falaê Brasil — crie sua senha de acesso!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Seja bem-vindo ao Falaê Brasil! 🎉</Heading>
        <Text style={text}>
          O acesso à plataforma deve ser feito pelo botão abaixo:
        </Text>
        <Button style={button} href={confirmationUrl}>
          Acessar Plataforma
        </Button>
        <Text style={text}>
          Clique no botão e crie a sua senha de acesso!
        </Text>
        <Text style={footer}>
          Caso ainda esteja com algum problema ou dificuldades para acessar,
          por gentileza entre em contato com nosso suporte:{' '}
          <Link href="mailto:atendimento@falaebrasil.com.br" style={link}>
            atendimento@falaebrasil.com.br
          </Link>
        </Text>
      </Container>
    </Body>
  </Html>
)

export default WelcomePurchaseEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily: 'Inter, -apple-system, "Segoe UI", Arial, sans-serif',
}
const container = { padding: '20px 25px' }
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
const link = { color: 'hsl(185, 84%, 42%)', textDecoration: 'underline' }
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