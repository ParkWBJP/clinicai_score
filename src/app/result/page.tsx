"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { translations } from '@/lib/i18n';
import { motion } from 'framer-motion';
import {
    PieChart, Pie, Cell, ResponsiveContainer,
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { CheckCircle, XCircle, MessageSquare, Loader2 } from 'lucide-react';
import { ScoreResult, SiteClassification } from '@/lib/types';
import { AIReport, AIGenerationMeta } from '@/lib/ai';

function ResultContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { locale } = useLanguage();
    const dict = translations[locale].result;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<{ score: ScoreResult; ai: AIReport | null; aiMeta?: AIGenerationMeta; pagesAnalyzed: number; siteClassification?: SiteClassification } | null>(null);
    const [viewScore, setViewScore] = useState(0);

    useEffect(() => {
        const stored = sessionStorage.getItem('analysisResult');
        if (stored) {
            try {
                const result = JSON.parse(stored);
                setData(result);
                // Animate score
                setTimeout(() => setViewScore(result.score.total), 500);
            } catch (e) {
                setError("Failed to load result data");
            } finally {
                setLoading(false);
            }
        } else {
            // No result found (direct access?) -> Redirect to home or show error
            // router.push('/'); 
            setError("No analysis result found. Please try again.");
            setLoading(false);
        }
    }, []);

    if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 className="animate-spin" /></div>;
    if (error) return <div className="container" style={{ padding: '80px', textAlign: 'center', color: 'red' }}>{error}</div>;
    if (!data) return null;

    const { score, ai, aiMeta, pagesAnalyzed, siteClassification } = data;

    if (siteClassification?.level === 'no') {
        return (
            <div style={{ minHeight: 'calc(100vh - 70px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
                <div className="card" style={{ maxWidth: '760px', width: '100%', padding: '32px 24px', textAlign: 'center' }}>
                    <h1 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '12px', color: '#111827' }}>
                        {dict.not_hospital.title}
                    </h1>
                    <p style={{ margin: '0 0 10px', fontSize: '14px', color: '#374151', lineHeight: '1.6' }}>
                        {dict.not_hospital.body}
                    </p>
                    <p style={{ margin: '0 0 18px', fontSize: '13px', color: '#6B7280', lineHeight: '1.6' }}>
                        {dict.not_hospital.hint}
                    </p>

                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button className="btn-primary" style={{ padding: '12px 18px' }} onClick={() => router.replace('/') }>
                            {dict.not_hospital.primary}
                        </button>
                        <a
                            className="btn-primary"
                            style={{ padding: '12px 18px', background: '#111827' }}
                            href="https://clinicai-nu.vercel.app/"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {dict.not_hospital.secondary}
                        </a>
                    </div>

                    <p style={{ margin: '16px 0 0', fontSize: '13px', color: '#2563EB', fontWeight: 600 }}>
                        {dict.not_hospital.note}
                    </p>
                </div>
            </div>
        );
    }

    if (!ai) return <div className="container" style={{ padding: '80px', textAlign: 'center', color: 'red' }}>AI result missing</div>;

    const categoryKeys: Array<keyof ScoreResult['categories']> = ['relevance', 'structure', 'indexing', 'trust', 'faq_schema'];
    const fallbackCheckLabel = locale === 'ko' ? '근거 제한' : '根拠が限定的';

    const categoryScores = [
        { subject: dict.categories.relevance, A: score.categories.relevance, fullMark: 20 },
        { subject: dict.categories.structure, A: score.categories.structure, fullMark: 20 },
        { subject: dict.categories.indexing, A: score.categories.indexing, fullMark: 20 },
        { subject: dict.categories.trust, A: score.categories.trust, fullMark: 20 },
        { subject: dict.categories.faq_schema, A: score.categories.faq_schema, fullMark: 20 },
    ];

    const donutData = [
        { name: 'Score', value: viewScore },
        { name: 'Remaining', value: 100 - viewScore },
    ];
    const donutColors = ['#2563EB', '#E5E7EB'];

    return (
        <div style={{ paddingBottom: '80px' }}>

            {/* Top Notice */}
            <div style={{ background: '#EFF6FF', padding: '12px 20px', textAlign: 'center', borderBottom: '1px solid #DBEAFE' }}>
                <p style={{ fontSize: '14px', color: '#1E40AF', fontWeight: 500 }}>
                    {dict.top_notice} <span style={{ marginLeft: '8px', fontWeight: 700 }}>({dict.analyzed_pages}: {pagesAnalyzed}/10)</span>
                </p>
            </div>

            <div className="container" style={{ marginTop: '40px' }}>

                {siteClassification?.level === 'uncertain' && (
                    <div
                        className="card"
                        style={{
                            padding: '12px 16px',
                            marginBottom: '14px',
                            borderColor: '#93C5FD',
                            background: '#EFF6FF'
                        }}
                    >
                        <p style={{ margin: 0, fontSize: '13px', color: '#1E40AF', fontWeight: 600 }}>
                            {dict.uncertain_badge}
                        </p>
                    </div>
                )}

                {aiMeta?.status && aiMeta.status !== 'ok' && (
                    <div
                        className="card"
                        style={{
                            padding: '12px 16px',
                            marginBottom: '20px',
                            borderColor: '#F59E0B',
                            background: '#FFFBEB'
                        }}
                    >
                        <p style={{ margin: 0, fontSize: '13px', color: '#92400E', fontWeight: 600 }}>
                            {locale === 'ko'
                                ? 'AI 요약 생성이 제한되어 규칙 기반 결과 중심으로 표시됩니다.'
                                : 'AI要約の生成が制限されているため、ルールベースの結果を中心に表示します。'}
                        </p>
                        {aiMeta.message && (
                            <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#92400E' }}>
                                {aiMeta.message}
                            </p>
                        )}
                    </div>
                )}

                {/* Top Section: Score & Radar */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '40px' }}>

                    {/* Total Score */}
                    <motion.div
                        className="card"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '320px' }}
                    >
                        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '24px', color: '#374151' }}>Total Score</h2>
                        <div style={{ position: 'relative', width: '200px', height: '200px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={donutData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={70}
                                        outerRadius={90}
                                        startAngle={90}
                                        endAngle={-270}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {donutData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={donutColors[index]} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                                <span style={{ fontSize: '48px', fontWeight: 800, color: '#2563EB' }}>{Math.round(viewScore)}</span>
                                <span style={{ fontSize: '14px', color: '#9CA3AF' }}>/ 100</span>
                            </div>
                        </div>
                    </motion.div>

                    {/* Radar Chart */}
                    <motion.div
                        className="card"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        style={{ minHeight: '320px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                    >
                        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px', color: '#374151' }}>Analysis Balance</h2>
                        <div style={{ width: '100%', height: '280px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={categoryScores}>
                                    <PolarGrid stroke="#E5E7EB" />
                                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#6B7280', fontSize: 12 }} />
                                    <PolarRadiusAxis angle={30} domain={[0, 20]} tick={false} axisLine={false} />
                                    <Radar
                                        name="Score"
                                        dataKey="A"
                                        stroke="#2563EB"
                                        fill="#2563EB"
                                        fillOpacity={0.4}
                                    />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                    </motion.div>
                </div>

                {/* AI Overview */}
                {/* AI Overview */}
                <motion.div
                    className="card"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    style={{ marginBottom: '40px', borderLeft: '4px solid #2563EB', background: '#F0F9FF', border: 'none', padding: '24px' }}
                >
                    <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1E40AF', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <MessageSquare size={20} /> AI Analysis Overview
                    </h3>

                    {/* 1. Summary */}
                    <p style={{ fontSize: '15px', lineHeight: '1.7', color: '#374151', marginBottom: '20px' }}>
                        {ai.overview_summary}
                    </p>

                    {/* 2. Divider & Clinic.ai Insight */}
                    <div style={{ borderTop: '1px dashed #BFDBFE', margin: '16px 0', paddingTop: '16px' }}>
                        <p style={{ fontSize: '15px', fontWeight: 600, color: '#1D4ED8', display: 'flex', gap: '8px' }}>
                            <span style={{ fontSize: '18px' }}>💡</span>
                            {ai.overview_clinicai}
                        </p>
                    </div>

                    {/* 3. Priorities */}
                    <div style={{ marginTop: '20px', background: 'rgba(255,255,255,0.6)', padding: '16px', borderRadius: '8px' }}>
                        <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#4B5563', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Top 3 Priorities
                        </h4>
                        <ol style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {ai.overview_priorities?.map((p, i) => (
                                <li key={i} style={{ fontSize: '14px', fontWeight: 500, color: '#1F2937' }}>
                                    {p}
                                </li>
                            ))}
                        </ol>
                    </div>
                </motion.div>

                {/* Detailed Diagnosis */}
                <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '20px' }}>Detailed Diagnosis</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '60px' }}>
                    {categoryScores.map((cat, idx) => (
                        <motion.div
                            key={idx}
                            className="card"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3, delay: 0.6 + (idx * 0.1) }}
                            style={{ display: 'flex', flexDirection: 'column' }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>{cat.subject}</h3>
                                <span style={{ fontSize: '18px', fontWeight: 800, color: cat.A >= 16 ? '#10B981' : '#F59E0B' }}>
                                    {cat.A}<span style={{ fontSize: '14px', color: '#9CA3AF', fontWeight: 400 }}>/20</span>
                                </span>
                            </div>

                            <p style={{ fontSize: '14px', color: '#4B5563', lineHeight: '1.5', marginBottom: '16px', flex: 1 }}>
                                {/* Map dynamically from AI result card_overviews if keys match logic, else use safe defaults or map index */}
                                {idx === 0 && ai.card_overviews.relevance}
                                {idx === 1 && ai.card_overviews.structure}
                                {idx === 2 && ai.card_overviews.indexing}
                                {idx === 3 && ai.card_overviews.trust}
                                {idx === 4 && ai.card_overviews.faq_schema}
                            </p>

                            <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {(() => {
                                    const key = categoryKeys[idx];
                                    const checks = score.details.checks?.[key] ?? [];
                                    const normalized = checks.length >= 4
                                        ? checks.slice(0, 4)
                                        : [...checks, ...Array.from({ length: 4 - checks.length }, (_, i) => ({ key: `fallback_${i}`, ok: false, label: fallbackCheckLabel }))];

                                    return normalized.map((item) => (
                                        <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#374151' }}>
                                            {item.ok ? <CheckCircle size={14} color="#10B981" /> : <XCircle size={14} color="#EF4444" />}
                                            <span>{item.label}</span>
                                        </div>
                                    ));
                                })()}
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* CTA Section */}
                <div style={{ textAlign: 'center', padding: '60px 20px', background: '#111827', borderRadius: '16px', color: 'white', marginBottom: '40px' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px' }}>{dict.cta_title}</h2>
                    <button className="btn-primary" style={{ background: '#2563EB', fontSize: '18px', padding: '16px 32px' }}>
                        {dict.cta_btn}
                    </button>
                </div>

            </div>
        </div>
    );
}

export default function ResultPage() {
    return (
        <Suspense fallback={<div className="container" style={{ padding: '80px', textAlign: 'center' }}>Loading...</div>}>
            <ResultContent />
        </Suspense>
    );
}
