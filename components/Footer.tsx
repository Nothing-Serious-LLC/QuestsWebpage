import Link from 'next/link';

export default function Footer() {
  const footerLinks = [
    { href: '/', label: 'Home' },
    { href: '/contact', label: 'Contact' },
    { href: '/privacy', label: 'Privacy' },
    { href: '/terms', label: 'Terms' },
  ];

  return (
    <footer className="mt-auto py-12 px-6 border-t border-[var(--div)] text-center bg-[var(--bg-secondary)]">
      <p className="mb-6 text-[var(--txt-secondary)]">
        &copy; {new Date().getFullYear()} Quests App
      </p>
      <div className="flex flex-wrap justify-center gap-6">
        {footerLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-[var(--txt)] no-underline font-semibold transition-colors duration-[var(--transition-fast)] relative hover:text-[var(--accent)]"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </footer>
  );
}

