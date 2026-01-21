"use client";

import React from 'react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { translations } from '@/lib/i18n';
import { Globe } from 'lucide-react';

export default function Header() {
    const { locale, setLocale, t } = useLanguage();
    const dict = translations[locale].header;

    const toggleLanguage = () => {
        setLocale(locale === 'ko' ? 'ja' : 'ko');
    };

    const [isMenuOpen, setIsMenuOpen] = React.useState(false);

    return (
        <header className="header" style={{ height: '70px', padding: '0 20px', borderBottom: '1px solid #E5E7EB', backgroundColor: '#fff', position: 'sticky', top: 0, zIndex: 100 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', height: '100%' }}>
                {/* Logo */}
                <div className="logo" style={{ fontWeight: 800, fontSize: '24px', letterSpacing: '-0.5px' }}>
                    <Link href="/">Clinic.ai</Link>
                </div>

                {/* Desktop Nav */}
                <nav className="desktop-nav" style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
                    <a href="https://clinicai-nu.vercel.app/" target="_blank" rel="noopener noreferrer" style={{ fontSize: '15px', fontWeight: 500, color: '#4B5563' }}>{dict.about}</a>
                    <a href="https://clinicai-nu.vercel.app/" target="_blank" rel="noopener noreferrer" style={{ fontSize: '15px', fontWeight: 500, color: '#4B5563' }}>{dict.why}</a>
                    <a href="https://clinicai-nu.vercel.app/" target="_blank" rel="noopener noreferrer" style={{ fontSize: '15px', fontWeight: 500, color: '#4B5563' }}>{dict.success}</a>
                    <a href="https://clinicai-nu.vercel.app/" target="_blank" rel="noopener noreferrer" style={{ fontSize: '15px', fontWeight: 500, color: '#4B5563' }}>{dict.solution}</a>
                </nav>

                {/* Actions (Desktop) */}
                <div className="desktop-actions" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <button
                        onClick={toggleLanguage}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: '1px solid #E5E7EB', borderRadius: '20px', padding: '6px 12px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
                    >
                        <Globe size={16} />
                        {locale.toUpperCase()}
                    </button>
                    <button className="btn-primary" style={{ fontSize: '14px' }}>
                        {dict.cta}
                    </button>
                </div>

                {/* Mobile Menu Button */}
                <button
                    className="mobile-menu-btn"
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {isMenuOpen ? <path d="M18 6L6 18M6 6l12 12" /> : <path d="M3 12h18M3 6h18M3 18h18" />}
                    </svg>
                </button>
            </div>

            {/* Mobile Menu Dropdown */}
            {isMenuOpen && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', borderBottom: '1px solid #E5E7EB',
                    padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                }}>
                    <nav style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <a href="https://clinicai-nu.vercel.app/" target="_blank" rel="noopener noreferrer" style={{ fontSize: '16px', fontWeight: 500, color: '#4B5563' }}>{dict.about}</a>
                        <a href="https://clinicai-nu.vercel.app/" target="_blank" rel="noopener noreferrer" style={{ fontSize: '16px', fontWeight: 500, color: '#4B5563' }}>{dict.why}</a>
                        <a href="https://clinicai-nu.vercel.app/" target="_blank" rel="noopener noreferrer" style={{ fontSize: '16px', fontWeight: 500, color: '#4B5563' }}>{dict.success}</a>
                        <a href="https://clinicai-nu.vercel.app/" target="_blank" rel="noopener noreferrer" style={{ fontSize: '16px', fontWeight: 500, color: '#4B5563' }}>{dict.solution}</a>
                    </nav>
                    <div style={{ height: '1px', background: '#E5E7EB', width: '100%' }}></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <button
                            onClick={toggleLanguage}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'none', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, width: '100%' }}
                        >
                            <Globe size={16} />
                            {locale === 'ko' ? '한국어' : '日本語'} ({locale.toUpperCase()})
                        </button>
                        <button className="btn-primary" style={{ fontSize: '14px', width: '100%', textAlign: 'center' }}>
                            {dict.cta}
                        </button>
                    </div>
                </div>
            )}
        </header>
    );
}
