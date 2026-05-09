import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
  Button,
  Section,
  Hr,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'

interface TrialReminderEmailProps {
  firstName: string
  lastName: string
  daysRemaining: number
  trialEndDate: string
  reminderType: 'trial_reminder_7_days' | 'trial_reminder_3_days' | 'trial_reminder_1_day' | 'trial_expired' | 'grace_period_reminder' | 'account_suspended'
  upgradeUrl: string
}

const getReminderContent = (reminderType: string, daysRemaining: number) => {
  switch (reminderType) {
    case 'trial_reminder_7_days':
      return {
        subject: 'Your trial expires in 7 days - Don\'t lose access!',
        preview: 'Your Zira Homes trial is ending soon. Upgrade now to keep all your data and features.',
        heading: 'Your trial expires in 7 days',
        message: 'You\'ve been exploring Zira Homes for a while now, and we hope you\'re loving the experience! Your trial period will end in 7 days, but you can continue enjoying all our powerful property management features by upgrading today.',
        urgency: false
      }
    case 'trial_reminder_3_days':
      return {
        subject: 'Only 3 days left in your trial',
        preview: 'Don\'t lose access to your property management tools. Upgrade your Zira Homes account now.',
        heading: 'Only 3 days remaining!',
        message: 'Time is running out! Your Zira Homes trial expires in just 3 days. Don\'t lose access to your property data, tenant management tools, and financial reports. Upgrade now to maintain uninterrupted service.',
        urgency: true
      }
    case 'trial_reminder_1_day':
      return {
        subject: 'Last day of your trial - Upgrade now!',
        preview: 'This is your final reminder. Your trial expires tomorrow. Upgrade to keep your data.',
        heading: 'Final reminder: 1 day left!',
        message: 'This is your last chance! Your Zira Homes trial expires tomorrow. After that, you\'ll lose access to all your property data and management tools. Upgrade now to avoid any interruption to your property management workflow.',
        urgency: true
      }
    case 'trial_expired':
      return {
        subject: 'Trial expired - Limited time to upgrade',
        preview: 'Your trial has expired but you still have time to upgrade and restore full access.',
        heading: 'Your trial has expired',
        message: 'Your Zira Homes trial period has ended, but don\'t worry! You have a 7-day grace period to upgrade your account. During this time, your data is safe but access is limited. Upgrade now to restore full functionality.',
        urgency: true
      }
    case 'grace_period_reminder':
      return {
        subject: 'Grace period ending soon - Upgrade required',
        preview: 'Your grace period is almost over. Upgrade now to avoid losing access to your data.',
        heading: 'Grace period ending soon',
        message: 'Your 7-day grace period is almost over. If you don\'t upgrade soon, your account will be suspended and you may lose access to your property management data. Don\'t let that happen - upgrade today!',
        urgency: true
      }
    case 'account_suspended':
      return {
        subject: 'Account suspended - Upgrade to restore access',
        preview: 'Your account has been suspended. Upgrade now to restore immediate access to all features.',
        heading: 'Account suspended',
        message: 'Your Zira Homes account has been suspended due to an expired trial. Your data is still safe, but you currently have no access to the platform. Upgrade now to immediately restore full access to all your property management tools.',
        urgency: true
      }
    default:
      return {
        subject: 'Zira Homes Trial Update',
        preview: 'Update about your trial status',
        heading: 'Trial Update',
        message: 'We have an update about your trial status.',
        urgency: false
      }
  }
}

export const TrialReminderEmail = ({
  firstName,
  lastName,
  daysRemaining,
  trialEndDate,
  reminderType,
  upgradeUrl,
}: TrialReminderEmailProps) => {
  const content = getReminderContent(reminderType, daysRemaining)
  const name = firstName && lastName ? `${firstName} ${lastName}` : firstName || 'Valued Customer'

  return (
    <Html>
      <Head />
      <Preview>{content.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logo}>🏠 Zira Homes</Text>
          </Section>
          
          <Heading style={content.urgency ? urgentHeading : heading}>
            {content.heading}
          </Heading>
          
          <Text style={greeting}>Hi {name},</Text>
          
          <Text style={text}>{content.message}</Text>
          
          {daysRemaining > 0 && (
            <Section style={highlightBox}>
              <Text style={highlightText}>
                <strong>Trial ends:</strong> {trialEndDate}<br/>
                <strong>Days remaining:</strong> {daysRemaining}
              </Text>
            </Section>
          )}
          
          <Section style={benefitsSection}>
            <Text style={benefitsTitle}>What you'll keep with a paid plan:</Text>
            <Text style={benefitsList}>
              ✅ Unlimited properties and units<br/>
              ✅ Advanced financial reporting<br/>
              ✅ Automated rent collection<br/>
              ✅ Maintenance request management<br/>
              ✅ Tenant communication tools<br/>
              ✅ SMS notifications<br/>
              ✅ Priority customer support
            </Text>
          </Section>
          
          <Section style={ctaSection}>
            <Button href={upgradeUrl} style={content.urgency ? urgentButton : button}>
              {content.urgency ? 'Upgrade Now - Don\'t Lose Access!' : 'Upgrade Your Account'}
            </Button>
          </Section>
          
          {content.urgency && (
            <Text style={urgentNote}>
              ⚠️ <strong>Important:</strong> Upgrading ensures you never lose access to your valuable property data and management tools.
            </Text>
          )}
          
          <Hr style={hr} />
          
          <Text style={footer}>
            Need help? Contact our support team at{' '}
            <Link href="mailto:support@ziratech.com" style={link}>
              support@ziratech.com
            </Link>{' '}or call <strong>+254 757 878 023</strong>
          </Text>

          <Text style={footer}>
            <Link href={upgradeUrl} style={link}>
              Upgrade Account
            </Link>
            {' | '}
            <Link href="https://zirahomes.com/support" style={link}>
              Get Support
            </Link>
          </Text>

          <Text style={footer}>
            Can't find our emails in your inbox? Please check your Spam/Junk folder or the Updates/Promotions tab and mark as "Not spam" to ensure future delivery.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default TrialReminderEmail

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
}

const header = {
  padding: '20px 30px',
  backgroundColor: '#2563eb',
}

const logo = {
  color: '#ffffff',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '0',
  textAlign: 'center' as const,
}

const heading = {
  fontSize: '32px',
  lineHeight: '1.3',
  fontWeight: '700',
  color: '#1f2937',
  padding: '0 30px',
  marginTop: '30px',
  marginBottom: '20px',
}

const urgentHeading = {
  ...heading,
  color: '#dc2626',
}

const greeting = {
  fontSize: '16px',
  lineHeight: '24px',
  color: '#374151',
  padding: '0 30px',
  marginBottom: '20px',
}

const text = {
  fontSize: '16px',
  lineHeight: '24px',
  color: '#374151',
  padding: '0 30px',
  marginBottom: '30px',
}

const highlightBox = {
  backgroundColor: '#fef3c7',
  border: '2px solid #f59e0b',
  borderRadius: '8px',
  padding: '20px',
  margin: '30px 30px',
}

const highlightText = {
  fontSize: '16px',
  color: '#92400e',
  margin: '0',
  textAlign: 'center' as const,
}

const benefitsSection = {
  backgroundColor: '#f0f9ff',
  padding: '30px',
  margin: '30px 30px',
  borderRadius: '8px',
}

const benefitsTitle = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: '#1e40af',
  marginBottom: '15px',
}

const benefitsList = {
  fontSize: '14px',
  lineHeight: '22px',
  color: '#1e40af',
  margin: '0',
}

const ctaSection = {
  textAlign: 'center' as const,
  padding: '30px',
}

const button = {
  backgroundColor: '#2563eb',
  borderRadius: '5px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
}

const urgentButton = {
  ...button,
  backgroundColor: '#dc2626',
  fontSize: '18px',
  padding: '16px 32px',
}

const urgentNote = {
  fontSize: '14px',
  lineHeight: '20px',
  color: '#dc2626',
  padding: '0 30px',
  marginTop: '20px',
  textAlign: 'center' as const,
  backgroundColor: '#fef2f2',
  padding: '15px 30px',
  margin: '20px 30px',
  borderRadius: '6px',
}

const hr = {
  borderColor: '#e5e7eb',
  margin: '20px 30px',
}

const footer = {
  color: '#6b7280',
  fontSize: '12px',
  lineHeight: '16px',
  padding: '0 30px',
  textAlign: 'center' as const,
  marginTop: '12px',
}

const link = {
  color: '#2563eb',
  textDecoration: 'underline',
}