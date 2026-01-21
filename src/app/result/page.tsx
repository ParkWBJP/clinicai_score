"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { translations } from '@/lib/i18n';
import { motion } from 'framer-motion';
import {
    PieChart, Pie, Cell, ResponsiveContainer,
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { CheckCircle, XCircle, MessageSquare, Loader2 } from 'lucide-react';
import { ScoreResult } from '@/lib/types';
import { AIReport } from '@/lib/ai';

function ResultContent() {
    const searchParams = useSearchParams();
    const { locale } = useLanguage();
    const dict = translations[locale].result;

    const jobId = searchParams.get('jobId');

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<{ score: ScoreResult; ai: AIReport; pagesAnalyzed: number } | null>(null);

    const [viewScore, setViewScore] = useState(0); // Animated display score

    useEffect(() => {
        if (!jobId) {
            // Fallback/Mock mode if accessed without Job ID (or redirect)
            setError("No Job ID provided");
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                const res = await fetch(`/api/status?id=${jobId}`);
                if (!res.ok) throw new Error("Failed to fetch result");
                const job = await res.json();

                if (job.status === 'completed' && job.result) {
                    setData(job.result);
                    // Animate score
                    setTimeout(() => setViewScore(job.result.score.total), 500);
                } else {
                    setError("Analysis not ready or failed");
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [jobId]);

    if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 className="animate-spin" /></div>;
    if (error) return <div className="container" style={{ padding: '80px', textAlign: 'center', color: 'red' }}>{error}</div>;
    if (!data) return null;

    const { score, ai, pagesAnalyzed } = data;

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
                <motion.div
                    className="card"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    style={{ marginBottom: '40px', borderLeft: '4px solid #2563EB', background: '#F0F9FF', border: 'none' }}
                >
                    <div style={{ padding: '24px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1E40AF', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <MessageSquare size={20} /> AI Analysis Overview
                        </h3>
                        <p style={{ fontSize: '16px', lineHeight: '1.7', color: '#374151' }}>
                            {ai.overview_100}
                        </p>
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#374151' }}>
                                    {/* Placeholder Logic for Checks - ideally comes from `details` signals */}
                                    {cat.A > 5 ? <CheckCircle size={14} color="#10B981" /> : <XCircle size={14} color="#EF4444" />}
                                    <span>{locale === 'ko' ? "기본 기준 충족" : "基本基準の充足"}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#374151' }}>
                                    {cat.A > 15 ? <CheckCircle size={14} color="#10B981" /> : <XCircle size={14} color="#EF4444" />}
                                    <span>{locale === 'ko' ? "최적화 양호" : "最適化良好"}</span>
                                </div>
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
