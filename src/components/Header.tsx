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

    return (
        <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '80px', padding: '0 24px', borderBottom: '1px solid #E5E7EB', backgroundColor: '#fff' }}>
            <div className="logo" style={{ fontWeight: 800, fontSize: '24px', letterSpacing: '-0.5px' }}>
                <Link href="/">Clinic.ai</Link>
            </div>

            <nav style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
                <a href="https://clinicai-nu.vercel.app/" target="_blank" rel="noopener noreferrer" style={{ fontSize: '15px', fontWeight: 500, color: '#4B5563' }}>{dict.about}</a>
                <a href="https://clinicai-nu.vercel.app/" target="_blank" rel="noopener noreferrer" style={{ fontSize: '15px', fontWeight: 500, color: '#4B5563' }}>{dict.why}</a>
                <a href="https://clinicai-nu.vercel.app/" target="_blank" rel="noopener noreferrer" style={{ fontSize: '15px', fontWeight: 500, color: '#4B5563' }}>{dict.success}</a>
                <a href="https://clinicai-nu.vercel.app/" target="_blank" rel="noopener noreferrer" style={{ fontSize: '15px', fontWeight: 500, color: '#4B5563' }}>{dict.solution}</a>
            </nav>

            <div className="actions" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <button
                    onClick={toggleLanguage}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'none',
                        border: '1px solid #E5E7EB',
                        borderRadius: '20px',
                        padding: '6px 12px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 600
                    }}
                >
                    <Globe size={16} />
                    {locale.toUpperCase()}
                </button>
                <button className="btn-primary" style={{ fontSize: '14px' }}>
                    {dict.cta}
                </button>
            </div>
        </header>
    );
}
