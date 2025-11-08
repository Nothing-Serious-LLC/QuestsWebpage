import Image from 'next/image';
import Link from 'next/link';

const features = [
  {
    title: 'Shared Challenges',
    description:
      'Build better habits as a team. Join friends for group Quests and see when everyone checks in so you stay accountable together.',
    icon: '🤝',
  },
  {
    title: 'Instant Invites',
    description:
      'Launch a Quest and invite friends in seconds via text. Getting your crew onboard takes just a couple taps.',
    icon: '⚡️',
  },
  {
    title: 'Daily Check-Ins & Streaks',
    description:
      'Keep momentum with streak tracking, gentle reminders, and daily progress updates that celebrate consistency.',
    icon: '🔥',
  },
  {
    title: 'Earn Points & Badges',
    description:
      'Complete Quests to earn points you can redeem for in-app cosmetics and unlock badges that mark every milestone.',
    icon: '🏅',
  },
  {
    title: 'Climb the Leaderboards',
    description:
      'Friendly competition keeps everyone motivated. See who is out in front and cheer each other on.',
    icon: '📈',
  },
];

const workflow = [
  {
    step: '01',
    title: 'Pick or create your Quest',
    description:
      'Choose from curated challenges like "Getting Enlightened" or 75 Hard, or design your own habit journey in seconds.',
    image: {
      src: '/screenshots/SC3.png',
      alt: 'Quest selection screen in the Quests mobile app',
      width: 692,
      height: 1500,
    },
  },
  {
    step: '02',
    title: 'Invite friends & family',
    description:
      'Send instant invites so everyone shows up. Group check-ins, reactions, and shared streaks keep the energy high.',
    image: {
      src: '/screenshots/SC5.png',
      alt: 'Invite friends flow showing contacts and groups',
      width: 609,
      height: 1320,
    },
  },
  {
    step: '03',
    title: 'Stay on track together',
    description:
      'Daily reminders, leaderboards, and progress dashboards turn accountability into a motivating loop you actually enjoy.',
    image: {
      src: '/screenshots/SC7.png',
      alt: 'Progress calendar view with daily check-ins',
      width: 609,
      height: 1320,
    },
  },
];

const gallery = [
  {
    src: '/screenshots/SC1.png',
    alt: 'Quests home screen showing active habits and streaks',
    width: 609,
    height: 1320,
  },
  {
    src: '/screenshots/SC2.png',
    alt: 'Quest tiles highlighting community challenges',
    width: 609,
    height: 1320,
  },
  {
    src: '/screenshots/SC6.png',
    alt: 'Points dashboard with rewards and unlocks',
    width: 692,
    height: 1500,
  },
];

export default function Home() {
  return (
    <main>
      <section className="py-20 px-0">
        <div className="w-[90%] max-w-[1200px] mx-auto grid gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,360px)] items-center">
          <div className="space-y-8 fade-in">
            <span className="inline-flex items-center gap-2 rounded-full bg-[rgba(255,255,255,0.08)] px-4 py-2 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--txt-secondary)]">
              Habit-building made social
            </span>
            <h1 className="text-[clamp(2.75rem,5vw,4.25rem)] font-bold leading-tight text-[var(--txt)] fade-in-up">
              Turn self-improvement into a shared adventure.
            </h1>
            <p className="text-lg md:text-xl text-[var(--txt-secondary)] max-w-[680px] leading-relaxed fade-in-up">
              Quests is the only habit tracking app purpose-built for accountability. Select or create a Quest, meditate for 30 days, conquer 75 Hard, or crush Dry January, and bring friends along for the journey. Daily check-ins, shared streaks, and real-time encouragement keep everyone engaged.
            </p>
            <p className="text-lg text-[var(--txt-secondary)] leading-relaxed fade-in-up">
              Start your first Quest today and grow together. Earn points, unlock badges, and climb the leaderboard as a team.
            </p>
            <div className="flex flex-wrap items-center gap-4 fade-in-up">
              <a
                href="https://apps.apple.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 rounded-xl bg-[var(--accent)] px-6 py-3 font-semibold text-white shadow-[var(--shadow-md)] transition-transform duration-[var(--transition-base)] hover:-translate-y-0.5 hover:bg-[var(--accent-hover)]"
              >
                <span>Download on the App Store</span>
              </a>
              <a
                href="https://play.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 rounded-xl border border-[rgba(255,255,255,0.24)] px-6 py-3 font-semibold text-[var(--txt)] transition-all duration-[var(--transition-base)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                <span>Get it on Google Play</span>
              </a>
              <Link
                href="/#features"
                className="inline-flex items-center gap-2 text-[var(--accent)] font-semibold transition-colors duration-[var(--transition-fast)] hover:text-[var(--accent-hover)]"
              >
                See features →
              </Link>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 rounded-3xl bg-[rgba(10,17,40,0.6)] p-6 shadow-[var(--shadow-lg)] backdrop-blur">
              <div>
                <p className="text-4xl font-bold text-white">65%</p>
                <p className="text-sm text-[var(--txt-secondary)]">More likely to succeed when you commit with a friend.</p>
              </div>
              <div>
                <p className="text-4xl font-bold text-white">95%</p>
                <p className="text-sm text-[var(--txt-secondary)]">Success rate when you schedule regular accountability check-ins.</p>
              </div>
              <div className="sm:col-span-2 lg:col-span-1">
                <p className="text-sm text-[var(--txt-secondary)]">
                  Source: ASTD 2014 study on accountability and goal achievement - the foundation of the Quests system.
                </p>
              </div>
            </div>
          </div>
          <div className="relative flex justify-center md:justify-end fade-in-up">
            <div className="relative w-full max-w-[360px]">
              <div className="absolute inset-0 -translate-x-6 translate-y-6 rounded-[32px] bg-[linear-gradient(135deg,rgba(92,133,214,0.35),rgba(51,102,204,0.15))] blur-3xl" />
              <Image
                src="/screenshots/SC1.png"
                alt="Quests mobile app home screen"
                width={609}
                height={1320}
                priority
                className="relative rounded-[32px] border border-[rgba(255,255,255,0.12)] shadow-[0_25px_60px_rgba(11,21,56,0.55)]"
              />
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-20 bg-[rgba(10,17,40,0.55)]">
        <div className="w-[90%] max-w-[1200px] mx-auto">
          <div className="mb-14 flex flex-col gap-4 text-center">
            <h2 className="text-4xl font-semibold text-white">Built for social accountability</h2>
            <p className="mx-auto max-w-[760px] text-lg text-[var(--txt-secondary)]">
              Everything in Quests is intentionally crafted to help groups stay motivated, from instant invites to the points economy that rewards your progress.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="flex h-full flex-col gap-4 rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[var(--card)] p-8 shadow-[var(--shadow-lg)] transition-transform duration-[var(--transition-base)] hover:-translate-y-1"
              >
                <span className="text-4xl" aria-hidden>{feature.icon}</span>
                <h3 className="text-2xl font-semibold text-white">{feature.title}</h3>
                <p className="text-[var(--txt-secondary)] leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="w-[90%] max-w-[1200px] mx-auto grid gap-10 md:grid-cols-3">
          {gallery.map((shot) => (
            <div
              key={shot.src}
              className="relative rounded-[32px] border border-[rgba(255,255,255,0.1)] bg-[rgba(10,17,40,0.55)] p-4 shadow-[0_20px_50px_rgba(11,21,56,0.45)]"
            >
              <Image
                src={shot.src}
                alt={shot.alt}
                width={shot.width}
                height={shot.height}
                className="rounded-[24px]"
              />
            </div>
          ))}
        </div>
      </section>

      <section className="py-20 bg-[rgba(10,17,40,0.65)]">
        <div className="w-[90%] max-w-[1200px] mx-auto">
          <div className="mb-16 flex flex-col gap-4 text-center">
            <h2 className="text-4xl font-semibold text-white">How Quests keeps you moving</h2>
            <p className="mx-auto max-w-[760px] text-lg text-[var(--txt-secondary)]">
              Three simple moments power the experience: a shared commitment, effortless invites, and ongoing check-ins that make accountability automatic.
            </p>
          </div>
          <div className="grid gap-12 lg:grid-cols-3">
            {workflow.map((item) => (
              <div
                key={item.title}
                className="flex flex-col gap-6 rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[var(--card)] p-8 shadow-[var(--shadow-lg)]"
              >
                <span className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--txt-secondary)]">
                  {item.step}
                </span>
                <h3 className="text-2xl font-semibold text-white">{item.title}</h3>
                <p className="text-[var(--txt-secondary)] leading-relaxed">{item.description}</p>
                <div className="relative overflow-hidden rounded-[24px] border border-[rgba(255,255,255,0.12)]">
                  <Image
                    src={item.image.src}
                    alt={item.image.alt}
                    width={item.image.width}
                    height={item.image.height}
                    className="rounded-[24px]"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="download" className="py-20">
        <div className="w-[90%] max-w-[1100px] mx-auto rounded-[40px] bg-[linear-gradient(135deg,#5C85D6,#3366CC)] px-10 py-16 text-center shadow-[0_25px_60px_rgba(24,56,140,0.55)]">
          <h2 className="text-4xl font-semibold text-white">Ready to start your first Quest?</h2>
          <p className="mt-4 text-lg text-white/80">
            Download Quests to turn your goals into a group adventure. Earn rewards, stay accountable, and celebrate progress together.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a
              href="https://apps.apple.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 rounded-xl bg-white px-6 py-3 font-semibold text-[var(--accent)] transition-transform duration-[var(--transition-base)] hover:-translate-y-0.5"
            >
              <span>App Store</span>
            </a>
            <a
              href="https://play.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 rounded-xl border border-white/60 px-6 py-3 font-semibold text-white transition-transform duration-[var(--transition-base)] hover:-translate-y-0.5 hover:bg-white/10"
            >
              <span>Google Play</span>
            </a>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-xl border border-white/60 px-6 py-3 font-semibold text-white transition-transform duration-[var(--transition-base)] hover:-translate-y-0.5 hover:bg-white/10"
            >
              Talk with us →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
