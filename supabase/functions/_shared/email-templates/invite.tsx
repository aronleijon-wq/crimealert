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

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>Du har blivit inbjuden till CrimeAlert</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src="https://pqoiwiiydtikouzjrllx.supabase.co/storage/v1/object/public/email-assets/logo.png"
          alt="CrimeAlert"
          width="140"
          height="auto"
          style={{ margin: '0 0 24px' }}
        />
        <Heading style={h1}>Du har blivit inbjuden</Heading>
        <Text style={text}>
          Du har blivit inbjuden att gå med i{' '}
          <Link href={siteUrl} style={link}>
            <strong>CrimeAlert</strong>
          </Link>
          . Klicka på knappen nedan för att acceptera inbjudan och skapa ditt konto.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Acceptera inbjudan
        </Button>
        <Text style={footer}>
          Om du inte förväntade dig denna inbjudan kan du ignorera detta meddelande.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

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
