import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Link, Preview, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  name?: string
  productName?: string
  email?: string
}

const APP = 'https://app.falaebrasil.com.br'

const Email = ({ name, productName, email }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Pagamento confirmado: seu acesso já está liberado no app Falaê Brasil</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Pagamento confirmado! 🎉</Heading>
        <Text style={text}>{name ? `Oi, ${name}!` : 'Olá!'}</Text>
        <Text style={text}>
          Seu acesso a <strong>{productName || 'seu novo produto'}</strong> já está liberado no aplicativo Falaê Brasil.
        </Text>
        <Text style={text}>
          Entre com o mesmo e-mail que você usou na compra{email ? ` (${email})` : ''} e a sua senha de sempre.
        </Text>
        <Button style={button} href={`${APP}/auth`}>Acessar o aplicativo</Button>
        <Text style={text}>
          Esqueceu a senha? Crie uma nova em poucos segundos:{' '}
          <Link href={`${APP}/auth?forgot=1`} style={link}>clique aqui</Link> e use a opção "Esqueci minha senha".
        </Text>
        <Text style={footer}>
          Precisa de ajuda? Fale com o suporte:{' '}
          <Link href="mailto:atendimento@falaebrasil.com.br" style={link}>atendimento@falaebrasil.com.br</Link>
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Props) => `Acesso liberado: ${d.productName || 'seu produto Falaê Brasil'}`,
  displayName: 'Compra confirmada (cliente com conta)',
  previewData: { name: 'Clóvis', productName: 'BST Guia de Entrevistas', email: 'cliente@exemplo.com' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, -apple-system, "Segoe UI", Arial, sans-serif' }
const container = { padding: '20px 25px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#102A55', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 20px' }
const link = { color: '#12A8B5', textDecoration: 'underline' }
const button = { backgroundColor: '#102A55', color: '#ffffff', fontSize: '15px', fontWeight: 'bold' as const, borderRadius: '14px', padding: '12px 20px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
