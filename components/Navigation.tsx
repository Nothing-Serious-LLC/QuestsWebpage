'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [mobileMenuOpen]);

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/contact', label: 'Contact' },
  ];

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname === href || pathname === `${href}/`;
  };

  return (
    <>
      <nav className="sticky top-0 z-[1000] bg-[rgba(9,15,36,0.92)] backdrop-blur-[12px] border-b border-[var(--div)] transition-all duration-[var(--transition-base)]">
        <div className="flex justify-between items-center px-[5%] py-6 max-w-[1200px] mx-auto">
          <Link 
            href="/" 
            className="flex items-center gap-3 text-xl font-semibold text-white no-underline transition-opacity duration-[var(--transition-fast)] hover:opacity-80"
          >
            <Image
              src="/logo.png"
              alt="Quests logo"
              width={36}
              height={36}
              className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.05)]"
              priority
            />
            <span className="bg-gradient-to-br from-[var(--txt)] to-[var(--accent)] bg-clip-text text-transparent">
              Quests
            </span>
          </Link>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex gap-8 items-center">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-[var(--txt)] no-underline font-semibold relative transition-colors duration-[var(--transition-fast)] hover:text-[var(--accent)] after:content-[''] after:absolute after:bottom-[-5px] after:left-0 after:w-0 after:h-[2px] after:bg-[var(--accent)] after:transition-all after:duration-[var(--transition-base)] hover:after:w-full ${
                  isActive(link.href) ? 'text-[var(--accent)] after:w-full' : ''
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden bg-transparent border-none text-[var(--txt)] text-2xl cursor-pointer p-2 transition-colors duration-[var(--transition-fast)] hover:text-[var(--accent)]"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div
        className={`fixed top-0 w-[80%] max-w-[300px] h-screen bg-[rgba(12,21,56,0.95)] shadow-[var(--shadow-xl)] transition-all duration-[var(--transition-base)] z-[2000] overflow-y-auto ${
          mobileMenuOpen ? 'right-0' : 'right-[-100%]'
        }`}
      >
        <div className="flex justify-between items-center p-6 border-b border-[var(--div)]">
          <span className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Quests logo"
              width={32}
              height={32}
              className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.05)]"
            />
            <span className="text-xl font-bold bg-gradient-to-br from-[var(--txt)] to-[var(--accent)] bg-clip-text text-transparent">
              Quests
            </span>
          </span>
          <button
            className="bg-transparent border-none text-[var(--txt)] text-2xl cursor-pointer p-2"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div className="flex flex-col p-6 gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-[var(--txt)] no-underline font-semibold text-lg transition-colors duration-[var(--transition-fast)] hover:text-[var(--accent)] ${
                isActive(link.href) ? 'text-[var(--accent)]' : ''
              }`}
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Mobile Overlay */}
      <div
        className={`fixed top-0 left-0 w-full h-full bg-[rgba(0,0,0,0.5)] transition-all duration-[var(--transition-base)] z-[1500] ${
          mobileMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}
        onClick={() => setMobileMenuOpen(false)}
      />
    </>
  );
}

