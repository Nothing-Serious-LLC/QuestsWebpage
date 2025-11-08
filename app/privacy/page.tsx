import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Quests Privacy Policy',
  description: 'Learn how Quests handles your privacy and data.',
};

const policyPoints = [
  {
    heading: 'Information we collect',
    items: [
      'Account details you provide (name, email, profile photo) so friends can find and identify you inside the app.',
      'Quest activity such as check-ins, streaks, reactions, and points to power accountability features.',
      'Device and usage data (app version, performance metrics, crash reports) that help us keep Quests running smoothly.',
    ],
  },
  {
    heading: 'How we use your information',
    items: [
      'Deliver core app functionality including shared habit tracking, reminders, leaderboards, and rewards.',
      'Personalize notifications and highlight meaningful milestones for you and your Quest group.',
      'Improve the product through aggregated analytics and feedback you choose to share with us.',
    ],
  },
  {
    heading: 'When we share data',
    items: [
      'With trusted infrastructure partners (such as Supabase) that host our databases and authentication, under strict privacy agreements.',
      'With friends you invite to a Quest, who can see the check-ins, comments, and celebrations you post in that shared space.',
      'If required by law, to comply with legal obligations or protect the rights, property, or safety of our community.',
    ],
  },
];

export default function Privacy() {
  return (
    <main>
      <section className="py-20 px-0">
        <div className="w-[90%] max-w-[1200px] mx-auto px-4 py-8 space-y-10">
          <h1 className="text-4xl font-bold bg-gradient-to-br from-[var(--txt)] to-[var(--accent)] bg-clip-text text-transparent">
            Privacy Policy
          </h1>
          <p className="text-lg text-[var(--txt-secondary)] leading-relaxed">
            This policy explains how Quests collects, uses, and protects your information when you use our mobile application and marketing site. We built Quests to make habit-building social and we treat your data with the same care we show our community.
          </p>
          <div className="grid gap-8">
            {policyPoints.map((point) => (
              <div key={point.heading} className="rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[var(--card)] p-8 shadow-[var(--shadow-lg)]">
                <h2 className="text-2xl font-semibold text-white mb-4">{point.heading}</h2>
                <ul className="list-disc space-y-3 pl-6 text-[var(--txt-secondary)]">
                  {point.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-lg text-[var(--txt-secondary)] leading-relaxed">
            You&apos;re always in control. You can delete a Quest, leave a group, or request account removal at any time by contacting{' '}
            <a
              href="mailto:privacy@thequestsapp.com"
              className="text-[var(--accent)] hover:text-[var(--accent-hover)]"
            >
              privacy@thequestsapp.com
            </a>
            . We respond to every request and will permanently delete your data unless legal obligations require otherwise.
          </p>
        </div>
      </section>
    </main>
  );
}
