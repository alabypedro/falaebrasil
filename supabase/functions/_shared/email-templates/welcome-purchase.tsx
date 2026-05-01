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
    <Preview>Sua compra foi confirmada — crie sua senha no Falaê Brasil!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Compra confirmada! 🎉</Heading>
        <Text style={text}>
          Que alegria ter você no{' '}
          <Link href={siteUrl} style={link}>
            <strong>Falaê Brasil!</strong>
          </Link>{' '}
          Sua compra foi processada com sucesso e seu acesso já está liberado.
        </Text>
        <Text style={text}>
          Criamos uma conta para o e-mail{' '}
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          . Para começar a usar a plataforma, defina sua senha clicando no
          botão abaixo. O link é pessoal e tem validade de 1 hora.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Criar minha senha e acessar
        </Button>
        <Text style={text}>
          Depois de criar sua senha, você já poderá entrar na plataforma e
          começar a praticar inglês com o Laboratório de Voz, os cursos e a
          biblioteca BST. Bora falar inglês de verdade! 🚀
        </Text>
        <Text style={footer}>
          Se você não reconhece esta compra, entre em contato com nosso
          suporte para que possamos ajudar.
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