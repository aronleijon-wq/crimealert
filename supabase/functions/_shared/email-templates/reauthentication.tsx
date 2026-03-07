/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>Din verifieringskod för CrimeAlert</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src="https://pqoiwiiydtikouzjrllx.supabase.co/storage/v1/object/public/email-assets/logo.png"
          alt="CrimeAlert"
          width="140"
          height="auto"
          style={{ margin: '0 0 24px' }}
        />
        <Heading style={h1}>Bekräfta din identitet</Heading>
        <Text style={text}>Använd koden nedan för att bekräfta din identitet:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          Koden upphör att gälla inom kort. Om du inte begärde detta kan du ignorera
          meddelandet.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '32px 28px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#0F172A',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#616B7C',
  lineHeight: '1.6',
  margin: '0 0 24px',
}
const codeStyle = {
  fontFamily: "'JetBrains Mono', Courier, monospace",
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#FF3D3D',
  margin: '0 0 30px',
  letterSpacing: '4px',
}
const footer = { fontSize: '12px', color: '#999999', margin: '32px 0 0' }
