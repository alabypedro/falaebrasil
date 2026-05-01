/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
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
    <Preview>Redefinir sua senha no Falaê Brasil!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Redefinição de senha 🔐</Heading>
        <Text style={text}>
          Recebemos um pedido para alterar a senha da sua conta no{' '}
          <strong>Falaê Brasil!</strong>.
        </Text>
        <Text style={text}>
          Para concluir o processo e cadastrar uma nova senha, clique no botão
          abaixo. O link é pessoal e tem validade de 1 hora.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Criar nova senha
        </Button>
        <Text style={text}>
          Após definir a nova senha, você poderá entrar normalmente na
          plataforma e continuar praticando seu inglês.
        </Text>
        <Text style={footer}>
          Se você não solicitou esta alteração, pode ignorar este e-mail com
          segurança — sua senha atual continuará a mesma.
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
