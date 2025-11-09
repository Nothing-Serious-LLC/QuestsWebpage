const stats = [
  { label: 'Active Adventurers', value: '260K+', sublabel: 'across 82 countries' },
  { label: 'Daily Steps Logged', value: '4.2M', sublabel: 'validated every 24 hours' },
  { label: 'Challenges Completed', value: '1.9M', sublabel: 'shared victories this year' },
  { label: 'Community Rating', value: '4.8★', sublabel: 'from 38,000 reviews' },
];

const steps = [
  {
    title: 'Choose Your Quest',
    description: 'Select a guided path or build your own ritual. Every quest adapts to your schedule.',
    icon: '🧭',
  },
  {
    title: 'Move With Your Crew',
    description: 'Invite friends, mentors, or teammates. Real-time check-ins keep everyone accountable.',
    icon: '🤝',
  },
  {
    title: 'Earn Real Rewards',
    description: 'Unlock perks, streak multipliers, and limited drops the more consistent you become.',
    icon: '🎯',
  },
];

const features = [
  {
    title: 'Adaptive Challenges',
    description:
      'From hydration to high-intensity movement, our adaptive engine personalizes quests around your goals and recovery needs.',
    icon: '⚡️',
  },
  {
    title: 'Proof of Progress',
    description:
      'Validated steps, mindful minutes, and wellness check-ins powered by privacy-first motion intelligence.',
    icon: '📈',
  },
  {
    title: 'Immersive Communities',
    description:
      'Pop-up crews, long-term circles, and guided cohorts led by coaches keep you inspired and accountable.',
    icon: '🌍',
  },
  {
    title: 'Reward Marketplace',
    description:
      'Redeem points for experiences, partner perks, and scholarship entries—curated for movement-minded people.',
    icon: '🎁',
  },
];

const testimonials = [
  {
    quote:
      'Quests helped our wellness team increase daily movement by 24% in the first month. The accountability loop really works.',
    name: 'Danielle McKay',
    role: 'People Operations, Everbright Labs',
  },
  {
    quote:
      'I’ve tried countless habit apps—Quests is the first that actually feels like an adventure with friends. I’m hooked.',
    name: 'Ravi Patel',
    role: 'Community Member since 2024',
  },
  {
    quote:
      'The guided quests and reflective check-ins created the exact structure our coaching clients needed to sustain change.',
    name: 'Henry Shukman',
    role: 'Zen Teacher & High-Performance Coach',
  },
];

const storyHighlights = [
  { title: 'City steps challenge', description: 'Boston neighbors transformed their commute into 11M verified steps.' },
  {
    title: 'Weekend reset crew',
    description: 'Five friends combined breathwork and movement to stay grounded through big transitions.',
  },
  { title: 'Campus quest league', description: 'University leaders gamified wellbeing and boosted participation by 42%.' },
];

const faq = [
  {
    question: 'How does motion validation protect my privacy?',
    answer:
      'We validate movement using on-device sensors and encrypted streak verification. Your raw location never leaves your phone.',
  },
  {
    question: 'Do I need teammates to start?',
    answer:
      'Solo quests are available anytime, and you can open them to friends whenever you’re ready for collaborative accountability.',
  },
  {
    question: 'Which devices and regions are supported?',
    answer:
      'Quests is live on iOS and Android in 80+ countries with localized rewards. More regions roll out every quarter.',
  },
];

export default function Home() {
  return (
    <main className="relative overflow-hidden min-h-screen bg-gradient-to-br from-[#0d1d67] via-[#2354FF] to-[#6eb1ff] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -right-20 h-80 w-80 rounded-full bg-white/20 blur-3xl" />
        <div className="absolute top-1/2 left-[-10rem] h-[32rem] w-[32rem] rounded-full bg-[#1d48ff]/40 blur-[180px]" />
        <div className="absolute bottom-[-8rem] right-[-6rem] h-[28rem] w-[28rem] rounded-full bg-sky-300/40 blur-[160px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.2),_transparent_55%)]" />
      </div>

      <nav className="relative z-10 max-w-7xl mx-auto px-6 py-8 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xl font-semibold tracking-tight">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 border border-white/20 font-black">
            Q
          </span>
          <span>Quests</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm uppercase tracking-[0.18em]">
          <a href="#how-it-works" className="hover:text-white/70 transition-colors">
            How it works
          </a>
          <a href="#features" className="hover:text-white/70 transition-colors">
            Features
          </a>
          <a href="#community" className="hover:text-white/70 transition-colors">
            Community
          </a>
          <a href="#faq" className="hover:text-white/70 transition-colors">
            FAQ
          </a>
        </div>
        <a
          href="#download"
          className="hidden md:inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 py-2 text-sm font-semibold uppercase tracking-[0.2em] transition hover:bg-white/20"
        >
          Download
        </a>
      </nav>

      <header className="relative z-10 pt-12 pb-28">
        <div className="max-w-7xl mx-auto px-6 flex flex-col-reverse lg:flex-row items-center gap-16">
          <div className="w-full lg:w-[46%]">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/80 text-[11px] font-bold text-[#082556]">
                ●
              </span>
              Now partnering with leading health innovators
            </div>
            <h1 className="mt-8 text-5xl md:text-6xl xl:text-7xl font-black leading-tight tracking-tight">
              Transform everyday movement into shared, meaningful quests.
            </h1>
            <p className="mt-6 text-lg md:text-xl text-white/85 leading-relaxed">
              Quests blends movement tracking, mindful practices, and community accountability into one immersive journey.
              You bring the intention—we power the ritual.
            </p>

            <ul className="mt-10 grid sm:grid-cols-2 gap-4 text-sm md:text-base">
              {['Minute-by-minute progress validation', 'Guided breath, focus, and movement sessions', 'Crew leaderboards & reflective prompts', 'Launch limited-time quests every weekend'].map((benefit) => (
                <li key={benefit} className="flex items-start gap-3 rounded-2xl bg-white/10 px-4 py-3 backdrop-blur">
                  <span className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#2354FF] text-xs font-bold">
                    ✓
                  </span>
                  <span className="text-white/90">{benefit}</span>
                </li>
              ))}
            </ul>

            <div id="download" className="mt-12 flex flex-col sm:flex-row gap-4">
              <a
                href="https://apps.apple.com"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex-1 sm:flex-none inline-flex items-center justify-center gap-3 rounded-2xl bg-white px-8 py-4 text-[#2354FF] font-semibold text-lg shadow-[0_18px_40px_-12px_rgba(12,20,56,0.65)] transition hover:-translate-y-1 hover:shadow-[0_22px_44px_-12px_rgba(6,12,40,0.75)]"
              >
                <svg className="h-9 w-9" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
                App Store
              </a>
              <a
                href="https://play.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex-1 sm:flex-none inline-flex items-center justify-center gap-3 rounded-2xl border border-white/30 bg-white/5 px-8 py-4 font-semibold text-lg text-white shadow-[0_18px_40px_-12px_rgba(5,10,35,0.6)] transition hover:-translate-y-1 hover:bg-white/15 hover:shadow-[0_22px_44px_-12px_rgba(5,10,35,0.7)]"
              >
                <svg className="h-9 w-9" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
                </svg>
                Google Play
              </a>
            </div>
          </div>

          <div className="w-full lg:w-[46%]">
            <div className="relative">
              <div className="absolute -top-10 -right-6 h-40 w-40 rounded-full bg-white/30 blur-3xl" />
              <div className="relative rounded-[32px] border border-white/15 bg-white/10 p-8 backdrop-blur-lg shadow-[0_35px_70px_-30px_rgba(0,0,0,0.6)]">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-white/70">
                  <span>Quest dashboard</span>
                  <span>Live</span>
                </div>
                <div className="mt-6 grid gap-4">
                  <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                    <p className="text-sm uppercase tracking-[0.18em] text-white/60">Today&apos;s focus</p>
                    <div className="mt-3 flex items-end justify-between">
                      <h3 className="text-3xl font-black">Momentum Minutes</h3>
                      <span className="rounded-full bg-emerald-400/80 px-3 py-1 text-xs font-semibold text-[#082556]">
                        +12 streak
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-white/75">
                      Breathwork • Low-impact movement • Reflective check-in
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-gradient-to-br from-white/15 to-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/60">Crew sync</p>
                      <p className="mt-2 text-2xl font-semibold">93% engaged</p>
                      <p className="text-xs text-white/70">12 of 13 teammates checked in</p>
                    </div>
                    <div className="rounded-2xl bg-gradient-to-br from-white/15 to-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/60">Reward path</p>
                      <p className="mt-2 text-2xl font-semibold">1870 pts</p>
                      <p className="text-xs text-white/70">3 perks unlocked</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/20 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/60">Reflection</p>
                    <p className="mt-3 text-sm text-white/80">
                      “Moved with Mia before sunrise. Shared our wins and lined up tomorrow’s reset quest.”
                    </p>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-10 -left-10 hidden w-52 sm:block">
                <div className="rounded-3xl border border-white/20 bg-white/10 p-5 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/60">Crew leaderboard</p>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">Ava</span>
                      <span className="rounded-full bg-white/15 px-3 py-1 text-xs">41 quests</span>
                    </div>
                    <div className="flex items-center justify-between text-white/75">
                      <span>Mia</span>
                      <span>39</span>
                    </div>
                    <div className="flex items-center justify-between text-white/75">
                      <span>Jun</span>
                      <span>37</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="relative z-10 border-t border-white/10 bg-white/5 py-16 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 grid gap-10 md:grid-cols-4">
          {stats.map((item) => (
            <div key={item.label} className="rounded-3xl border border-white/15 bg-white/5 p-6 text-center backdrop-blur">
              <p className="text-3xl font-black">{item.value}</p>
              <p className="mt-2 text-sm uppercase tracking-[0.15em] text-white/70">{item.label}</p>
              <p className="mt-1 text-xs text-white/60">{item.sublabel}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="relative z-10 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-2xl">
            <p className="text-sm uppercase tracking-[0.25em] text-white/60">How quests works</p>
            <h2 className="mt-4 text-4xl md:text-5xl font-black leading-tight">
              A simple rhythm that keeps you moving, mindful, and connected.
            </h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.title} className="group rounded-3xl border border-white/15 bg-white/10 p-8 backdrop-blur transition hover:-translate-y-1 hover:bg-white/15">
                <div className="flex items-center justify-between">
                  <span className="text-5xl">{step.icon}</span>
                  <span className="text-sm uppercase tracking-[0.2em] text-white/60">Step</span>
                </div>
                <h3 className="mt-6 text-2xl font-semibold">{step.title}</h3>
                <p className="mt-3 text-sm text-white/80 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="relative z-10 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-xl">
              <p className="text-sm uppercase tracking-[0.25em] text-white/60">The quests platform</p>
              <h2 className="mt-4 text-4xl md:text-5xl font-black leading-tight">
                Tools, rituals, and rewards designed with behavioral science.
              </h2>
            </div>
            <a
              href="#download"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 py-3 text-xs font-semibold uppercase tracking-[0.24em] transition hover:bg-white/20"
            >
              Start a quest
            </a>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-3xl border border-white/10 bg-white/10 p-8 backdrop-blur-lg shadow-[0_28px_60px_-32px_rgba(0,0,0,0.65)]">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-3xl">
                  {feature.icon}
                </div>
                <h3 className="mt-7 text-2xl font-semibold">{feature.title}</h3>
                <p className="mt-3 text-sm text-white/80 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 py-24">
        <div className="max-w-6xl mx-auto px-6 rounded-[42px] border border-white/15 bg-white/10 p-10 md:p-16 backdrop-blur-lg">
          <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-white/60">Field stories</p>
              <h2 className="mt-4 text-4xl md:text-5xl font-black leading-tight">
                From morning walks to breakthrough retreats, crews use Quests to create lasting change.
              </h2>
              <div className="mt-10 grid gap-6 md:grid-cols-3">
                {storyHighlights.map((story) => (
                  <div key={story.title} className="rounded-3xl border border-white/15 bg-white/5 p-5 text-sm leading-relaxed text-white/80">
                    <p className="font-semibold text-white">{story.title}</p>
                    <p className="mt-2">{story.description}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-6">
              {testimonials.map((testimonial) => (
                <div key={testimonial.name} className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/15 to-white/5 p-7 text-white/85">
                  <p className="text-sm leading-relaxed italic">“{testimonial.quote}”</p>
                  <p className="mt-4 text-sm font-semibold text-white">{testimonial.name}</p>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/60">{testimonial.role}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="community" className="relative z-10 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-xl">
              <p className="text-sm uppercase tracking-[0.25em] text-white/60">Trusted collaborators</p>
              <h2 className="mt-4 text-4xl md:text-5xl font-black leading-tight">
                Empowering wellness teams, coaches, and communities to sustain momentum.
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm uppercase tracking-[0.2em] text-white/65 md:grid-cols-3">
              <span className="rounded-full border border-white/20 px-4 py-2 text-center">Nexus Health</span>
              <span className="rounded-full border border-white/20 px-4 py-2 text-center">Elevate Labs</span>
              <span className="rounded-full border border-white/20 px-4 py-2 text-center">Mindful City</span>
              <span className="rounded-full border border-white/20 px-4 py-2 text-center">Peak Teams</span>
              <span className="rounded-full border border-white/20 px-4 py-2 text-center">Glow Retreats</span>
              <span className="rounded-full border border-white/20 px-4 py-2 text-center">Pulse Collective</span>
            </div>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {['Unlock corporate wellness perks with real outcomes.', 'Host pop-up quests with curated playlists and coaching prompts.', 'Analyze community momentum in real time with privacy-first insights.'].map(
              (item) => (
                <div key={item} className="rounded-3xl border border-white/10 bg-white/10 p-8 text-sm leading-relaxed text-white/80 backdrop-blur transition hover:-translate-y-1 hover:bg-white/15">
                  {item}
                </div>
              ),
            )}
          </div>
        </div>
      </section>

      <section id="faq" className="relative z-10 py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="max-w-xl">
            <p className="text-sm uppercase tracking-[0.25em] text-white/60">Questions, answered</p>
            <h2 className="mt-4 text-4xl md:text-5xl font-black leading-tight">
              Everything you need to begin your next quest with confidence.
            </h2>
          </div>
          <div className="mt-12 space-y-6">
            {faq.map((item) => (
              <details key={item.question} className="group rounded-3xl border border-white/10 bg-white/10 p-6 backdrop-blur">
                <summary className="cursor-pointer text-lg font-semibold text-white transition group-open:text-white/80">
                  {item.question}
                </summary>
                <p className="mt-4 text-sm leading-relaxed text-white/75">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 py-28">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-5 py-2 text-xs uppercase tracking-[0.24em]">
            Featured quests dropping weekly
          </div>
          <h2 className="mt-8 text-5xl md:text-6xl font-black leading-tight">
            Ready to turn your next goal into an unforgettable quest?
          </h2>
          <p className="mt-6 text-lg text-white/80 md:text-xl">
            Download Quests and join a crew of movers, meditators, and changemakers building healthier habits together.
          </p>
          <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="https://apps.apple.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 rounded-2xl bg-white px-10 py-4 text-lg font-semibold text-[#2354FF] shadow-[0_18px_40px_-12px_rgba(12,20,56,0.65)] transition hover:-translate-y-1 hover:shadow-[0_22px_44px_-12px_rgba(6,12,40,0.75)]"
            >
              <svg className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
              Download for iOS
            </a>
            <a
              href="https://play.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 rounded-2xl border border-white/30 bg-white/5 px-10 py-4 text-lg font-semibold text-white shadow-[0_18px_40px_-12px_rgba(5,10,35,0.6)] transition hover:-translate-y-1 hover:bg-white/15 hover:shadow-[0_22px_44px_-12px_rgba(5,10,35,0.7)]"
            >
              <svg className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
              </svg>
              Download for Android
            </a>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/10 bg-white/5">
        <div className="max-w-6xl mx-auto px-6 py-12 flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3 text-lg font-semibold">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 border border-white/20 font-black">
              Q
            </span>
            <span>Quests</span>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-white/70">
            <a href="mailto:hello@thequestsapp.com" className="transition hover:text-white">
              Contact
            </a>
            <a href="mailto:partners@thequestsapp.com" className="transition hover:text-white">
              Partnerships
            </a>
            <a href="mailto:privacy@thequestsapp.com" className="transition hover:text-white">
              Privacy
            </a>
            <a href="mailto:legal@thequestsapp.com" className="transition hover:text-white">
              Terms
            </a>
          </div>
          <p className="text-xs uppercase tracking-[0.25em] text-white/50">
            © {new Date().getFullYear()} Quests · Move with purpose.
          </p>
        </div>
      </footer>
    </main>
  );
}

