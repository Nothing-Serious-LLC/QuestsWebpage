import Image from 'next/image';

export default function Home() {
  return (
    <main className="relative overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center gradient-blue overflow-hidden">
        {/* Animated background circles */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 -left-20 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-float"></div>
          <div className="absolute bottom-20 -right-20 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-float delay-200"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 text-center text-white">
          {/* Logo */}
          <div className="mb-8 animate-scale-in">
        <Image
              src="/logo.png"
              alt="Quests"
              width={120}
              height={120}
              className="mx-auto rounded-[32px] shadow-2xl"
          priority
        />
          </div>

          <h1 className="text-6xl md:text-8xl font-black mb-6 animate-fade-in-up delay-100">
            Turn Goals into<br />
            <span className="bg-gradient-to-r from-yellow-200 to-pink-200 bg-clip-text text-transparent">
              Shared Adventures
            </span>
          </h1>

          <p className="text-xl md:text-2xl font-medium mb-12 max-w-3xl mx-auto opacity-95 animate-fade-in-up delay-200">
            The social habit tracker that makes self-improvement fun. Join friends in daily challenges, earn rewards, and build better habits together.
          </p>

          {/* Download Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in-up delay-300">
            <a
              href="https://apps.apple.com"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative px-10 py-5 bg-white text-[#3366CC] rounded-2xl font-bold text-lg shadow-2xl hover:shadow-3xl hover:-translate-y-1 transition-all duration-300 flex items-center gap-3"
            >
              <span className="text-3xl">📱</span>
              <div className="text-left">
                <div className="text-xs opacity-70">Download on the</div>
                <div className="text-lg">App Store</div>
              </div>
            </a>
            <a
              href="https://play.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative px-10 py-5 bg-black/20 backdrop-blur-sm text-white rounded-2xl font-bold text-lg border-2 border-white/30 hover:bg-white/10 hover:-translate-y-1 transition-all duration-300 flex items-center gap-3"
            >
              <span className="text-3xl">🤖</span>
              <div className="text-left">
                <div className="text-xs opacity-70">Get it on</div>
                <div className="text-lg">Google Play</div>
              </div>
            </a>
          </div>

          {/* Stats */}
          <div className="mt-20 grid grid-cols-2 md:grid-cols-3 gap-8 max-w-4xl mx-auto animate-fade-in-up delay-400">
            <div>
              <div className="text-5xl font-black mb-2">65%</div>
              <div className="text-sm opacity-90">More likely to succeed<br />with a friend</div>
            </div>
            <div>
              <div className="text-5xl font-black mb-2">95%</div>
              <div className="text-sm opacity-90">Success rate with<br />regular check-ins</div>
            </div>
            <div className="col-span-2 md:col-span-1">
              <div className="text-5xl font-black mb-2">1M+</div>
              <div className="text-sm opacity-90">Quests completed<br />together</div>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce">
            <svg className="w-6 h-6 text-white/60" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
            </svg>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-5xl md:text-6xl font-black text-center mb-6">
            Simple. Social. Rewarding.
          </h2>
          <p className="text-xl text-gray-600 text-center mb-20 max-w-2xl mx-auto">
            Three steps to building better habits with your crew
          </p>

          <div className="grid md:grid-cols-3 gap-12">
            {/* Step 1 */}
            <div className="text-center group">
              <div className="mb-8 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-pink-400 rounded-[40px] blur-2xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
                <Image
                  src="/screenshots/SC3.png"
                  alt="Choose your quest"
                  width={300}
                  height={650}
                  className="mx-auto rounded-[40px] shadow-2xl relative transform group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white font-bold text-xl mb-4">1</div>
              <h3 className="text-2xl font-bold mb-3">Pick Your Quest</h3>
              <p className="text-gray-600">
                Choose from challenges like 75 Hard, Dry January, or create your own custom goal
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center group">
              <div className="mb-8 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-[40px] blur-2xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
                <Image
                  src="/screenshots/SC5.png"
                  alt="Invite friends"
                  width={300}
                  height={650}
                  className="mx-auto rounded-[40px] shadow-2xl relative transform group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white font-bold text-xl mb-4">2</div>
              <h3 className="text-2xl font-bold mb-3">Invite Your Crew</h3>
              <p className="text-gray-600">
                Send instant invites to friends and family. Accountability is more fun together
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center group">
              <div className="mb-8 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-emerald-400 rounded-[40px] blur-2xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
                <Image
                  src="/screenshots/SC7.png"
                  alt="Track progress"
                  width={300}
                  height={650}
                  className="mx-auto rounded-[40px] shadow-2xl relative transform group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 text-white font-bold text-xl mb-4">3</div>
              <h3 className="text-2xl font-bold mb-3">Stay On Track</h3>
              <p className="text-gray-600">
                Daily check-ins, streaks, and leaderboards keep everyone motivated
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-32 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-5xl md:text-6xl font-black text-center mb-20">
            Everything You Need to Succeed
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Feature 1 */}
            <div className="bg-white rounded-3xl p-10 shadow-xl hover:shadow-2xl transition-shadow">
              <div className="text-5xl mb-4">🏆</div>
              <h3 className="text-3xl font-bold mb-4">Earn Rewards</h3>
              <p className="text-gray-600 text-lg leading-relaxed">
                Complete Quests to unlock badges, earn points, and redeem exclusive in-app cosmetics. Every milestone deserves celebration.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white rounded-3xl p-10 shadow-xl hover:shadow-2xl transition-shadow">
              <div className="text-5xl mb-4">🔥</div>
              <h3 className="text-3xl font-bold mb-4">Build Streaks</h3>
              <p className="text-gray-600 text-lg leading-relaxed">
                Daily check-ins keep your momentum going. Watch your streak grow and maintain consistency with gentle reminders.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white rounded-3xl p-10 shadow-xl hover:shadow-2xl transition-shadow">
              <div className="text-5xl mb-4">📊</div>
              <h3 className="text-3xl font-bold mb-4">Climb Leaderboards</h3>
              <p className="text-gray-600 text-lg leading-relaxed">
                Friendly competition keeps everyone engaged. See who&apos;s leading and cheer each other on to the finish line.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white rounded-3xl p-10 shadow-xl hover:shadow-2xl transition-shadow">
              <div className="text-5xl mb-4">💬</div>
              <h3 className="text-3xl font-bold mb-4">Stay Connected</h3>
              <p className="text-gray-600 text-lg leading-relaxed">
                React to updates, share encouragement, and celebrate wins together. Real-time engagement makes the journey fun.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-32 gradient-purple text-white">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="text-5xl md:text-6xl font-black mb-6">
            Powered by Science
          </h2>
          <p className="text-2xl opacity-95 mb-12 leading-relaxed">
            Studies show that teaming up with others dramatically boosts your chances of forming lasting habits. Quests is built on this principle of social accountability.
          </p>
          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20">
            <p className="text-lg opacity-90 italic">
              &ldquo;Committing to a goal with a friend makes you 65% more likely to succeed. Setting regular check-ins can raise your success rate to as high as 95%&rdquo;
            </p>
            <p className="text-sm opacity-75 mt-4">
              — American Society of Training and Development, 2014
            </p>
          </div>
        </div>
      </section>

      {/* Screenshot Gallery */}
      <section className="py-32 bg-black text-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-5xl md:text-6xl font-black text-center mb-20">
            See It In Action
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { src: '/screenshots/SC1.png', alt: 'Home screen' },
              { src: '/screenshots/SC2.png', alt: 'Quest details' },
              { src: '/screenshots/SC6.png', alt: 'Points and badges' },
            ].map((screenshot, idx) => (
              <div key={idx} className="group">
                <div className="relative overflow-hidden rounded-[40px]">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 group-hover:opacity-0 transition-opacity"></div>
                  <Image
                    src={screenshot.src}
                    alt={screenshot.alt}
                    width={400}
                    height={866}
                    className="w-full h-auto transform group-hover:scale-105 transition-transform duration-700"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 text-white relative overflow-hidden">
        {/* Background elements */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-yellow-400/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-400/20 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-5xl md:text-7xl font-black mb-8">
            Ready to Start Your Journey?
          </h2>
          <p className="text-2xl mb-12 opacity-95">
            Download Quests today and turn your goals into shared adventures
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center mb-16">
            <a
              href="https://apps.apple.com"
            target="_blank"
            rel="noopener noreferrer"
              className="px-12 py-6 bg-white text-purple-600 rounded-2xl font-bold text-xl shadow-2xl hover:shadow-3xl hover:-translate-y-2 transition-all duration-300"
            >
              📱 Download for iOS
          </a>
          <a
              href="https://play.google.com"
            target="_blank"
            rel="noopener noreferrer"
              className="px-12 py-6 bg-black/30 backdrop-blur-sm text-white rounded-2xl font-bold text-xl border-2 border-white/40 hover:bg-white/10 hover:-translate-y-2 transition-all duration-300"
            >
              🤖 Download for Android
            </a>
          </div>

          {/* Footer Links */}
          <div className="flex flex-wrap justify-center gap-8 text-sm opacity-80">
            <a href="mailto:hello@thequestsapp.com" className="hover:opacity-100 transition-opacity">
              Contact
            </a>
            <span>·</span>
            <a href="mailto:privacy@thequestsapp.com" className="hover:opacity-100 transition-opacity">
              Privacy
            </a>
            <span>·</span>
            <a href="mailto:legal@thequestsapp.com" className="hover:opacity-100 transition-opacity">
              Terms
            </a>
          </div>

          <p className="mt-8 text-sm opacity-60">
            © {new Date().getFullYear()} Quests App. Built with ❤️ by Nothing Serious LLC.
          </p>
        </div>
      </section>
      </main>
  );
}

