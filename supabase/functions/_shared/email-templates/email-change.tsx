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
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface EmailChangeEmailProps {
  siteName: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  email,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>Bekräfta din nya e-postadress för CrimeAlert</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src="https://pqoiwiiydtikouzjrllx.supabase.co/storage/v1/object/public/email-assets/logo.png"
          alt="CrimeAlert"
          width="140"
          height="auto"
          style={{ margin: '0 0 24px' }}
        />
        <Heading style={h1}>Bekräfta din nya e-postadress</Heading>
        <Text style={text}>
          Du har begärt att ändra din e-postadress för CrimeAlert från{' '}
          <Link href={`mailto:${email}`} style={link}>
            {email}
          </Link>{' '}
          till{' '}
          <Link href={`mailto:${newEmail}`} style={link}>
            {newEmail}
          </Link>
          .
        </Text>
        <Text style={text}>
          Klicka på knappen nedan för att bekräfta ändringen:
        </Text>
        <Button style={button} href={confirmationUrl}>
          Bekräfta e-poständring
        </Button>
        <Text style={footer}>
          Om du inte begärde denna ändring, säkra ditt konto omedelbart.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

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
const link = { color: '#FF3D3D', textDecoration: 'underline' }
const button = {
  backgroundColor: '#FF3D3D',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '600' as const,
  borderRadius: '8px',
  padding: '12px 24px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '32px 0 0' }
