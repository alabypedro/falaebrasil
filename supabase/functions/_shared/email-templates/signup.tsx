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

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Confirme seu e-mail para começar no Falaê Brasil!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Bem-vindo(a) ao Falaê Brasil! 🎉</Heading>
        <Text style={text}>
          Que bom ter você aqui! Seu cadastro na plataforma{' '}
          <Link href={siteUrl} style={link}>
            <strong>Falaê Brasil!</strong>
          </Link>{' '}
          foi recebido com sucesso.
        </Text>
        <Text style={text}>
          Para ativar sua conta e liberar o acesso ao Laboratório de Voz, aos
          cursos e à biblioteca BST, confirme seu e-mail (
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          ) clicando no botão abaixo:
        </Text>
        <Button style={button} href={confirmationUrl}>
          Confirmar meu e-mail
        </Button>
        <Text style={text}>
          Após a confirmação, você já poderá entrar na plataforma e começar a
          praticar seu inglês. Bora falar inglês de verdade! 🚀
        </Text>
        <Text style={footer}>
          Se você não criou uma conta no Falaê Brasil!, pode ignorar este
          e-mail com tranquilidade — nada será feito na sua conta.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

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
