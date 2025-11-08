import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact the Quests Team',
  description: 'Reach the Quests team for support, partnerships, or media inquiries.',
};

const contactChannels = [
  {
    title: 'Product Support',
    description:
      'Need help staying on track with a Quest or have ideas for new features? Email our product team and we\'ll help within two business days.',
    action: {
      label: 'support@thequestsapp.com',
      href: 'mailto:support@thequestsapp.com',
    },
  },
  {
    title: 'Partnerships & Community',
    description:
      'We love collaborating with wellness leaders, creators, and accountability groups. Let\'s explore how Quests can power your community challenges.',
    action: {
      label: 'partners@thequestsapp.com',
      href: 'mailto:partners@thequestsapp.com',
    },
  },
  {
    title: 'Feedback & Reviews',
    description:
      'Quests is built with our community. Share wins, feature requests, or ideas anytime; your notes directly shape our roadmap.',
    action: {
      label: 'hello@thequestsapp.com',
      href: 'mailto:hello@thequestsapp.com',
    },
  },
];

export default function Contact() {
  return (
    <main>
      <section className="py-20 px-0">
        <div className="w-[90%] max-w-[1200px] mx-auto px-4 py-8">
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-br from-[var(--txt)] to-[var(--accent)] bg-clip-text text-transparent">
            Get in Touch
          </h1>
          <p className="text-lg text-[var(--txt-secondary)] max-w-3xl leading-relaxed mb-12">
            Quests turns habit-building into a shared adventure, and we&apos;d love your help making it even better. Reach the team directly or visit our legacy contact page at{' '}
            <a
              href="https://nothingserious.info/contact.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] hover:text-[var(--accent-hover)]"
            >
              nothingserious.info/contact.html
            </a>
            .
          </p>
          <div className="grid gap-8 md:grid-cols-3">
            {contactChannels.map((channel) => (
              <div
                key={channel.title}
                className="flex h-full flex-col gap-4 rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[var(--card)] p-8 shadow-[var(--shadow-lg)]"
              >
                <h2 className="text-2xl font-semibold text-[var(--txt)]">{channel.title}</h2>
                <p className="text-[var(--txt-secondary)] leading-relaxed">{channel.description}</p>
                <a
                  href={channel.action.href}
                  className="mt-auto text-[var(--accent)] font-semibold hover:text-[var(--accent-hover)]"
                >
                  {channel.action.label}
                </a>
              </div>
            ))}
          </div>
          <div className="mt-12 rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[rgba(10,17,40,0.55)] p-8">
            <h2 className="text-2xl font-semibold text-white">Media kit & assets</h2>
            <p className="mt-3 max-w-3xl text-[var(--txt-secondary)]">
              Need logos or product screenshots (like the ones above) for press or partnerships? Email{' '}
              <a
                href="mailto:press@thequestsapp.com"
                className="text-[var(--accent)] hover:text-[var(--accent-hover)]"
              >
                press@thequestsapp.com
              </a>{' '}
              and we&apos;ll send the latest assets.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
