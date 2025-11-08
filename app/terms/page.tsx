import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Quests Terms of Service',
  description: 'Understand the terms that govern use of Quests.',
};

const termsSections = [
  {
    heading: 'Using Quests',
    items: [
      'You must be at least 13 years old (or the minimum age required in your region) to create an account.',
      'Keep your account credentials secure. You are responsible for everything that happens within your Quests groups.',
      'Use Quests for lawful, respectful habit tracking. Harassment, harmful challenges, or spamming invites is not allowed.',
    ],
  },
  {
    heading: 'Subscriptions & purchases',
    items: [
      'Certain cosmetic unlocks or premium features may require in-app purchases processed through the App Store or Google Play.',
      'Subscription billing, renewals, and refunds follow the policies of your app marketplace. Manage or cancel from your device settings.',
      'We may offer promotional trials; if you keep using paid features after the trial ends you authorize the marketplace to charge you.',
    ],
  },
  {
    heading: 'Content & community',
    items: [
      'Quest check-ins and comments are visible to members of that Quest. Remove sensitive information before sharing updates.',
      'We may remove content or suspend accounts that violate these terms or put the community at risk.',
      'You retain ownership of the content you post, but grant us permission to host and display it so the app can function.',
    ],
  },
];

export default function Terms() {
  return (
    <main>
      <section className="py-20 px-0">
        <div className="w-[90%] max-w-[1200px] mx-auto px-4 py-8 space-y-10">
          <h1 className="text-4xl font-bold bg-gradient-to-br from-[var(--txt)] to-[var(--accent)] bg-clip-text text-transparent">
            Terms of Service
          </h1>
          <p className="text-lg text-[var(--txt-secondary)] leading-relaxed">
            These terms explain your rights and responsibilities when using the Quests mobile application and marketing site. By creating an account or participating in a Quest you agree to follow these guidelines and our Privacy Policy.
          </p>
          <div className="grid gap-8">
            {termsSections.map((section) => (
              <div key={section.heading} className="rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[var(--card)] p-8 shadow-[var(--shadow-lg)]">
                <h2 className="text-2xl font-semibold text-white mb-4">{section.heading}</h2>
                <ul className="list-disc space-y-3 pl-6 text-[var(--txt-secondary)]">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-lg text-[var(--txt-secondary)] leading-relaxed">
            Have questions about these terms? Reach us anytime at{' '}
            <a
              href="mailto:legal@thequestsapp.com"
              className="text-[var(--accent)] hover:text-[var(--accent-hover)]"
            >
              legal@thequestsapp.com
            </a>
            . We may update these terms as Quests evolves; we&apos;ll notify you in-app or by email when material changes occur.
          </p>
        </div>
      </section>
    </main>
  );
}
