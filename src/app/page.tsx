"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { translations } from '@/lib/i18n';
import { koAddressData, jaAddressData } from '@/lib/addressData';
import { ChevronDown, CheckCircle, AlertCircle } from 'lucide-react';

export default function Home() {
    const router = useRouter();
    const { locale, t } = useLanguage();
    const dict = translations[locale].input;

    // Form State
    const [url, setUrl] = useState('');
    const [hospitalName, setHospitalName] = useState('');
    const [region1, setRegion1] = useState(''); // Province / Prefecture
    const [region2, setRegion2] = useState(''); // District / City
    const [keywords, setKeywords] = useState('');
    const [locationKeywords, setLocationKeywords] = useState('');
    const [brandingText, setBrandingText] = useState('');

    // Validation State
    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Options Toggle
    const [showOptions, setShowOptions] = useState(false);

    // Address Options based on locale
    const region1Options = locale === 'ko' ? koAddressData.provinces : jaAddressData.prefectures;
    const region2Options = locale === 'ko'
        ? (region1 && (koAddressData.districts as any)[region1] ? (koAddressData.districts as any)[region1] : [])
        : (region1 && (jaAddressData.cities as any)[region1] ? (jaAddressData.cities as any)[region1] : []);

    // Reset region2 when region1 changes
    useEffect(() => {
        setRegion2('');
    }, [region1]);

    const validate = () => {
        const newErrors: { [key: string]: string } = {};

        if (!url.trim()) newErrors.url = dict.error_required;
        else if (!/^https?:\/\//.test(url)) newErrors.url = dict.error_url;

        if (!hospitalName.trim()) newErrors.hospitalName = dict.error_required;
        if (!region1) newErrors.region1 = dict.error_required;
        // region2 might be optional if list is empty? enforcing for now if list exists
        if (region2Options.length > 0 && !region2) newErrors.region2 = dict.error_required;

        if (!keywords.trim()) newErrors.keywords = dict.error_required;

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        setIsSubmitting(true);

        // Simulate API call delay or just route
        // In real app, we might fire an API call here to start the job, 
        // but the requirements say "back-end backend analysis Job starts, frontend polls". 
        // We'll pass params via query or simple storage for now to /loading.
        // For now, let's just push to /loading and let /loading initiate the job.

        const params = new URLSearchParams({
            url,
            name: hospitalName,
            r1: region1,
            r2: region2,
            kw: keywords,
            lkw: locationKeywords,
            br: brandingText
        });

        router.push(`/loading?${params.toString()}`);
    };

    return (
        <div className="container" style={{ padding: '40px 16px', maxWidth: '800px' }}>
            <div className="card">
                <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '32px', textAlign: 'center' }}>
                    {locale === 'ko' ? '병원 온라인 진단 시작하기' : '病院オンライン診断を開始する'}
                </h1>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                    {/* URL Input */}
                    <div>
                        <label className="label">{dict.url_label} *</label>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="https://example.com"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            style={{ borderColor: errors.url ? 'var(--danger)' : undefined }}
                        />
                        {errors.url && <p style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '4px' }}>{errors.url}</p>}
                    </div>

                    {/* Hospital Name */}
                    <div>
                        <label className="label">{dict.hospital_name_label} *</label>
                        <input
                            type="text"
                            className="input-field"
                            value={hospitalName}
                            onChange={(e) => setHospitalName(e.target.value)}
                            style={{ borderColor: errors.hospitalName ? 'var(--danger)' : undefined }}
                        />
                        {errors.hospitalName && <p style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '4px' }}>{errors.hospitalName}</p>}
                    </div>

                    {/* Address */}
                    <div>
                        <label className="label">{dict.address_label} *</label>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <select
                                className="input-field"
                                value={region1}
                                onChange={(e) => setRegion1(e.target.value)}
                                style={{ borderColor: errors.region1 ? 'var(--danger)' : undefined }}
                            >
                                <option value="">{locale === 'ko' ? '시/도 선택' : '都道府県を選択'}</option>
                                {region1Options.map((opt: string) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>

                            <select
                                className="input-field"
                                value={region2}
                                onChange={(e) => setRegion2(e.target.value)}
                                disabled={!region1 || region2Options.length === 0}
                                style={{ borderColor: errors.region2 ? 'var(--danger)' : undefined }}
                            >
                                <option value="">{locale === 'ko' ? '시/군/구 선택' : '市町村を選択'}</option>
                                {region2Options.map((opt: string) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>
                        {(errors.region1 || errors.region2) && <p style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '4px' }}>{dict.error_required}</p>}
                    </div>

                    {/* Keywords */}
                    <div>
                        <label className="label">{dict.keywords_label} *</label>
                        <input
                            type="text"
                            className="input-field"
                            placeholder={dict.keywords_placeholder}
                            value={keywords}
                            onChange={(e) => setKeywords(e.target.value)}
                            style={{ borderColor: errors.keywords ? 'var(--danger)' : undefined }}
                        />
                        {errors.keywords && <p style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '4px' }}>{errors.keywords}</p>}
                    </div>

                    {/* Optional Toggle */}
                    <div style={{ padding: '16px', background: '#F9FAFB', borderRadius: '8px' }}>
                        <button
                            type="button"
                            onClick={() => setShowOptions(!showOptions)}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', fontSize: '14px', fontWeight: 600, cursor: 'pointer', color: 'var(--text-sub)' }}
                        >
                            <ChevronDown size={16} style={{ transform: showOptions ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                            {locale === 'ko' ? '추가 정보 입력 (선택)' : '追加情報入力 (任意)'}
                        </button>

                        {showOptions && (
                            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div>
                                    <label className="label">{dict.location_keywords_label}</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        value={locationKeywords}
                                        onChange={(e) => setLocationKeywords(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="label">{dict.branding_label}</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        value={brandingText}
                                        onChange={(e) => setBrandingText(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div style={{ marginTop: '16px' }}>
                        <button
                            type="submit"
                            className="btn-primary"
                            style={{ width: '100%', padding: '16px', fontSize: '18px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                // Simple loader
                                <div style={{ width: '20px', height: '20px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                            ) : (
                                <>
                                    <CheckCircle size={20} />
                                    {dict.start_btn}
                                </>
                            )}
                        </button>
                    </div>

                    <style jsx>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
                </form>
            </div>

            <div style={{ textAlign: 'center', marginTop: '32px', color: 'var(--text-sub)', fontSize: '14px', lineHeight: '1.6' }}>
                {locale === 'ko' ? (
                    <>
                        * 입력하신 정보는 진단 목적으로만 사용되며 저장되지 않습니다.<br />
                        * 분석에는 약 30초~1분 정도 소요될 수 있습니다.
                    </>
                ) : (
                    <>
                        * 入力された情報は診断目的でのみ使用され、保存されません。<br />
                        * 分析には約30秒〜1分程度かかる場合があります。
                    </>
                )}
            </div>
        </div>
    );
}
