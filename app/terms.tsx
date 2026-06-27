import { LegalDocument, type LegalSection } from '@/components/ui/legal-document';

const SECTIONS: LegalSection[] = [
  {
    heading: 'Acceptance',
    body: [
      'By creating an account or using Golden Sif ("Sif"), you agree to these Terms. If you do not agree, do not use the app.',
    ],
  },
  {
    heading: 'Your account',
    body: [
      'You are responsible for your account and for keeping your password secure. You must provide accurate information and be old enough to use the service in your region. You can delete your account at any time from Settings.',
    ],
  },
  {
    heading: 'Acceptable use',
    body: [
      '• Do not post unlawful, harassing, hateful, or infringing content.',
      '• Do not upload photos of other people without their permission.',
      '• Do not abuse, spam, or attempt to disrupt or reverse-engineer the service.',
      'We may remove content or suspend accounts that violate these Terms, and we provide blocking and reporting tools.',
    ],
  },
  {
    heading: 'Your content',
    body: [
      'You keep ownership of the content you create. You grant us a limited license to store and display it so we can operate the app and show it to the people you intend (for example, your followers or a stylist).',
    ],
  },
  {
    heading: 'Bookings and payments',
    body: [
      'Sif lets stylists and clients arrange appointments and process payments and deposits through Stripe. Sif is a platform that facilitates these arrangements; the haircut or styling service itself is provided by the stylist, not by Sif. Refunds, cancellations, and the service provided are between the client and the stylist, subject to any policies shown at booking.',
    ],
  },
  {
    heading: 'Virtual try-on',
    body: [
      'Try-on results are AI-generated previews for illustration only and may not reflect real-world results. Use of try-on requires your consent to process the photo you select.',
    ],
  },
  {
    heading: 'Disclaimers',
    body: [
      'The service is provided "as is" without warranties of any kind. To the maximum extent permitted by law, we are not liable for indirect or incidental damages arising from your use of the app.',
    ],
  },
  {
    heading: 'Changes',
    body: [
      'We may update these Terms from time to time. Continued use after changes means you accept the updated Terms.',
    ],
  },
  {
    heading: 'Contact',
    body: ['Questions about these Terms? Email us at support@goldensif.com.'],
  },
];

export default function TermsScreen() {
  return (
    <LegalDocument
      title="Terms of Service"
      effectiveDate="June 27, 2026"
      intro="These Terms govern your use of Golden Sif. Please read them carefully."
      sections={SECTIONS}
    />
  );
}
