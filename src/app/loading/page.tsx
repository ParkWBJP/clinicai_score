"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { translations } from '@/lib/i18n';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

function LoadingContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { locale } = useLanguage();
    const dict = translations[locale].loading;

    const [progress, setProgress] = useState(0);
    const [pagesCount, setPagesCount] = useState(0);
    const [currentStep, setCurrentStep] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const steps = [dict.step1, dict.step2, dict.step3, dict.step4];

    useEffect(() => {
        let isMounted = true;

        const startAnalysis = async () => {
            try {
                const res = await fetch('/api/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url: searchParams.get('url'),
                        hospitalName: searchParams.get('name'),
                        address: `${searchParams.get('r1')} ${searchParams.get('r2') || ''}`,
                        keywords: `${searchParams.get('kw')},${searchParams.get('lkw') || ''}`,
                        locale
                    })
                });

                if (!res.ok || !res.body) throw new Error("Connection failed");

                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || ''; // Keep partial line in buffer

                    for (const line of lines) {
                        if (!line.trim()) continue;
                        try {
                            const data = JSON.parse(line);

                            if (data.type === 'progress') {
                                if (isMounted) {
                                    setProgress(data.value);
                                    if (data.pagesCount) setPagesCount(data.pagesCount);

                                    // Update steps based on progress
                                    if (data.value < 40) setCurrentStep(0);
                                    else if (data.value < 70) setCurrentStep(1);
                                    else if (data.value < 90) setCurrentStep(2);
                                    else setCurrentStep(3);
                                }
                            } else if (data.type === 'complete') {
                                // Save result to storage to pass to Result page without large URL
                                sessionStorage.setItem('analysisResult', JSON.stringify(data.result));
                                router.replace('/result'); // Use replace to prevent going back to loading
                                return;
                            } else if (data.type === 'error') {
                                throw new Error(data.message);
                            }
                        } catch (e) {
                            console.error("Parse error", e);
                        }
                    }
                }
            } catch (err: any) {
                if (isMounted) setError(err.message || 'Error occurred');
            }
        };

        startAnalysis();

        return () => { isMounted = false; };
    }, [searchParams, router, locale]);

    if (error) {
        return (
            <div className="container" style={{ padding: '80px', textAlign: 'center' }}>
                <div className="card" style={{ padding: '40px', borderColor: 'var(--danger)' }}>
                    <h2 style={{ color: 'var(--danger)', marginBottom: '16px' }}>Error Occurred</h2>
                    <p>{error}</p>
                    <button onClick={() => router.back()} className="btn-primary" style={{ marginTop: '20px', background: '#6B7280' }}>
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="container" style={{ padding: '80px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="card" style={{ maxWidth: '600px', width: '100%', textAlign: 'center', padding: '60px 40px' }}>

                {/* Animated Scanner Visual */}
                <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto 32px' }}>
                    <div style={{
                        width: '50px', height: '64px', border: '2px solid #E5E7EB', borderRadius: '4px', margin: '8px auto',
                        position: 'relative', background: '#fff', overflow: 'hidden'
                    }}>
                        <div style={{ height: '8px', width: '60%', background: '#F3F4F6', margin: '8px auto 4px' }}></div>
                        <div style={{ height: '4px', width: '80%', background: '#F3F4F6', margin: '4px auto' }}></div>
                        <div style={{ height: '4px', width: '80%', background: '#F3F4F6', margin: '4px auto' }}></div>

                        <motion.div
                            style={{
                                position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                                background: 'var(--primary)', boxShadow: '0 0 8px var(--primary)'
                            }}
                            animate={{ top: ['0%', '100%'] }}
                            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                        />
                    </div>
                </div>

                <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>
                    {dict.main}
                </h2>
                <p style={{ color: 'var(--text-sub)', marginBottom: '32px' }}>
                    {dict.sub}
                </p>

                <div style={{ marginBottom: '24px' }}>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--primary)', marginBottom: '8px' }}>
                        {dict.notice.replace('10', '10')} ({pagesCount}/10)
                    </p>
                    {/* Progress Bar */}
                    <div style={{ width: '100%', height: '8px', background: '#E5E7EB', borderRadius: '4px', overflow: 'hidden' }}>
                        <motion.div
                            style={{ height: '100%', background: 'var(--primary)' }}
                            animate={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* Steps List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'start', maxWidth: '300px', margin: '0 auto' }}>
                    {steps.map((step, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: idx === currentStep ? 'var(--text-main)' : (idx < currentStep ? 'var(--success)' : '#D1D5DB') }}>
                            {idx < currentStep ? (
                                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                </div>
                            ) : idx === currentStep ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '1px solid #D1D5DB' }} />
                            )}
                            <span style={{ fontWeight: idx === currentStep ? 600 : 400 }}>{step} {idx === 0 && `(${pagesCount}/10)`}</span>
                        </div>
                    ))}
                </div>

            </div>
        </div>
    );
}

export default function LoadingPage() {
    return (
        <Suspense fallback={<div className="container" style={{ padding: '80px', textAlign: 'center' }}>Loading...</div>}>
            <LoadingContent />
        </Suspense>
    );
}
