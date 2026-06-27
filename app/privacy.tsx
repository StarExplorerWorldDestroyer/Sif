import { LegalDocument, type LegalSection } from '@/components/ui/legal-document';

const SECTIONS: LegalSection[] = [
  {
    heading: 'Who we are',
    body: [
      'Golden Sif ("Sif", "we", "us") is an app for tracking your haircut history, expenses, and styling preferences, and for connecting with stylists. This policy explains what we collect, why, and the choices you have.',
    ],
  },
  {
    heading: 'Information you provide',
    body: [
      '• Account: your email address and a password (stored only as a secure hash).',
      '• Profile: username, display name, bio, avatar, and preferences such as currency and units.',
      '• Haircut records: photos, notes, prices, tips, dates, and any stylist you associate with a cut.',
      '• Social content: posts, comments, likes, follows, connections, and reviews.',
      '• Messages: direct messages and any photos you attach, which are stored privately and shared only with the conversation participants.',
      '• Bookings: appointment details and services.',
      '• Try-on photos: if you use the virtual try-on, the selfie or reference photo you choose. Because these are images of your face, we ask for your explicit consent before any try-on runs.',
    ],
  },
  {
    heading: 'Information collected automatically',
    body: [
      '• Basic technical and usage data needed to operate the service, such as device/browser type and server logs.',
      '• If you opt in to push notifications, a notification token for your device or browser.',
      'We do not use third-party advertising or cross-app tracking.',
    ],
  },
  {
    heading: 'How we use your information',
    body: [
      '• To provide core features: saving your cuts, showing your profile, enabling social and messaging features, and scheduling bookings.',
      '• To process payments and deposits for appointments.',
      '• To generate virtual try-on results when you request them.',
      '• To send reminders and notifications you have enabled.',
      '• To keep the service safe, including blocking, reporting, and abuse prevention.',
    ],
  },
  {
    heading: 'Service providers we share with',
    body: [
      'We share data only with vendors that help us run Sif, under their respective privacy terms:',
      '• Supabase — hosting, database, authentication, and file storage.',
      '• Stripe — payment processing. Card details go directly to Stripe; we store payment status and amounts, not full card numbers.',
      '• Perfect Corp (YouCam) — processes your selected photo to generate virtual try-on results.',
      '• Cloudflare — bot/abuse protection on our sign-in forms (when enabled).',
      'We do not sell your personal information.',
    ],
  },
  {
    heading: 'Try-on photos and biometric data',
    body: [
      'Virtual try-on requires a photo of a face. We process that image only to produce the look you requested, only after you give explicit consent, and we record when that consent was given. You can delete saved looks and your uploaded selfies at any time from within the app.',
    ],
  },
  {
    heading: 'Your choices and rights',
    body: [
      '• Access and edit your profile and content in the app.',
      '• Delete individual items, including haircuts, posts, messages, and saved looks.',
      '• Delete your entire account from Settings → Delete account. This permanently removes your profile, content, photos, and account, and cannot be undone.',
      '• Manage notifications and privacy visibility in Settings.',
    ],
  },
  {
    heading: 'Data retention',
    body: [
      'We keep your information for as long as your account is active. When you delete your account, we delete your associated data and files. Some records may persist briefly in backups or where retention is required by law.',
    ],
  },
  {
    heading: "Children's privacy",
    body: [
      'Sif is not directed to children under 13 (or the minimum age required in your region), and we do not knowingly collect their data.',
    ],
  },
  {
    heading: 'Changes to this policy',
    body: [
      'We may update this policy from time to time. Material changes will be reflected by an updated effective date here.',
    ],
  },
  {
    heading: 'Contact',
    body: ['Questions about privacy? Email us at privacy@goldensif.com.'],
  },
];

export default function PrivacyScreen() {
  return (
    <LegalDocument
      title="Privacy Policy"
      effectiveDate="June 27, 2026"
      intro="Your privacy matters. This policy describes the personal information Sif collects, how we use it, and the control you have over it."
      sections={SECTIONS}
    />
  );
}
