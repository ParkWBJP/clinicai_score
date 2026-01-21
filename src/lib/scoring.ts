import { PageData, ScoreResult } from './types';

interface ScoreInput {
    hospitalName: string;
    keywords: string[];
    locale: 'ko' | 'ja';
}

function normalizeText(text: string): string {
    return (text || '').replace(/\s+/g, ' ').trim();
}

function coverageFactor(coverage: number): number {
    if (coverage >= 0.5) return 1;
    if (coverage >= 0.3) return 0.7;
    if (coverage >= 0.1) return 0.4;
    return 0;
}

function scoreByCoverage(args: {
    pagesAnalyzed: number;
    observedPages: number;
    strongObservedPages?: number;
    basePoints: number;
    minCoverage?: number;
}): number {
    const { pagesAnalyzed, observedPages, strongObservedPages = 0, basePoints, minCoverage } = args;
    if (pagesAnalyzed <= 0) return 0;

    // A-6: give a small weight boost when the same signal appears on “strong signal pages”.
    const weightedObserved = Math.min(pagesAnalyzed, observedPages + (strongObservedPages * 0.5));
    const coverage = weightedObserved / pagesAnalyzed;

    if (minCoverage !== undefined && coverage < minCoverage) return 0;
    return basePoints * coverageFactor(coverage);
}

function containsAny(text: string, needles: string[]): boolean {
    const hay = text.toLowerCase();
    return needles.some(n => hay.includes(n.toLowerCase()));
}

function isValidPage(page: PageData): boolean {
    return normalizeText(page.bodyText).length >= 400;
}

function isStrongSignalPage(page: PageData, locale: 'ko' | 'ja'): boolean {
    const combined = `${page.title}\n${page.h1.join(' ')}\n${page.h2.join(' ')}\n${page.bodyText}`;
    const hay = combined.toLowerCase();

    const patterns =
        locale === 'ko'
            ? ['원인', '증상', '치료', '시술', '부작용', '주의', '회복', '비용', '가격', 'faq', '질문']
            : ['原因', '症状', '治療', '施術', '副作用', '注意', '回復', '費用', '料金', 'faq', '質問'];

    const hits = patterns.reduce((count, term) => (hay.includes(term.toLowerCase()) ? count + 1 : count), 0);
    return hits >= 2;
}

function clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
}

export function calculateScore(pages: PageData[], input: ScoreInput): ScoreResult {
    const { hospitalName, keywords, locale } = input;
    const pagesAnalyzed = pages.length;

    if (pagesAnalyzed === 0) {
        return {
            total: 0,
            categories: { relevance: 0, structure: 0, indexing: 0, trust: 0, faq_schema: 0 },
            details: { signals: ['No pages analyzed'], metrics: { pagesAnalyzed: 0, validPages: 0, validRatio: 0, strongPages: 0 } },
        };
    }

    const keywordList = keywords.map(k => k.trim()).filter(Boolean);
    const keywordLower = keywordList.map(k => k.toLowerCase());

    const validPages = pages.filter(isValidPage);
    const validPagesCount = validPages.length;
    const validRatio = validPagesCount / pagesAnalyzed;

    const strongPages = validPages.filter(p => isStrongSignalPage(p, locale));
    const strongPagesCount = strongPages.length;

    const signals: string[] = [];
    signals.push(`pages_analyzed:${pagesAnalyzed}`);
    signals.push(`valid_pages:${validPagesCount}`);
    signals.push(`valid_ratio:${validRatio.toFixed(2)}`);
    signals.push(`strong_pages:${strongPagesCount}`);

    const pageHasAnyKeyword = (page: PageData) => {
        const combined = `${page.title}\n${page.h1.join(' ')}\n${page.h2.join(' ')}\n${page.url}\n${page.bodyText}`;
        const hay = combined.toLowerCase();
        return keywordLower.some(k => hay.includes(k));
    };

    const pageBodyTopHasKeyword = (page: PageData) => {
        const top = normalizeText(page.bodyText).slice(0, 320).toLowerCase();
        return keywordLower.some(k => top.includes(k));
    };

    const pageH1HasKeyword = (page: PageData) => {
        const h1Text = page.h1.join(' ').toLowerCase();
        return keywordLower.some(k => h1Text.includes(k));
    };

    const addressSignalsKo = ['주소', '오시는 길', '위치', '진료시간', '영업시간', '전화', '문의'];
    const addressSignalsJa = ['住所', 'アクセス', '所在地', '診療時間', '営業時間', '電話', 'お問い合わせ'];

    const pageHasContactInfo = (page: PageData) => {
        const body = normalizeText(page.bodyText);
        const phonePattern = /(\+?\d{1,3}[\s-]?)?(\d{2,3}[\s-]?)?\d{3,4}[\s-]?\d{4}/;
        const hasPhone = phonePattern.test(body);
        const cues = locale === 'ko' ? addressSignalsKo : addressSignalsJa;
        const hasCue = containsAny(body, cues);
        return hasPhone || hasCue;
    };

    const riskTermsKo = ['부작용', '주의', '주의사항', '금기', '합병증', '회복', '사후관리', '통증', '붓기', '멍'];
    const riskTermsJa = ['副作用', '注意', '注意事項', '禁忌', '合併症', '回復', 'アフターケア', '痛み', '腫れ', '内出血'];
    const pageHasRiskInfo = (page: PageData) => {
        const body = normalizeText(page.bodyText);
        const terms = locale === 'ko' ? riskTermsKo : riskTermsJa;
        return containsAny(body, terms);
    };

    const docTermsKo = ['의료진', '원장', '의사', '전문의', '경력', '학회', '자격'];
    const docTermsJa = ['医師', '院長', '医者', '専門医', '経歴', '学会', '資格'];
    const pageHasDoctorInfo = (page: PageData) => {
        const combined = `${page.title}\n${page.h1.join(' ')}\n${page.bodyText}`;
        const terms = locale === 'ko' ? docTermsKo : docTermsJa;
        return containsAny(combined, terms);
    };

    const pageHasFlow = (page: PageData) => {
        const text = `${page.h1.join(' ')} ${page.h2.join(' ')} ${normalizeText(page.bodyText)}`;
        const hay = text.toLowerCase();

        const cause = locale === 'ko' ? ['원인'] : ['原因'];
        const symptom = locale === 'ko' ? ['증상'] : ['症状'];
        const treatment = locale === 'ko' ? ['치료', '시술', '관리'] : ['治療', '施術'];

        const hasCause = cause.some(t => hay.includes(t.toLowerCase()));
        const hasSymptom = symptom.some(t => hay.includes(t.toLowerCase()));
        const hasTreatment = treatment.some(t => hay.includes(t.toLowerCase()));

        return hasCause && hasSymptom && hasTreatment;
    };

    const pageHasFaqSchema = (page: PageData) => page.schemaTypes.some(t => /faq/i.test(t) || /FAQPage/i.test(t));
    const pageHasMedicalSchema = (page: PageData) =>
        page.schemaTypes.some(t => /(MedicalClinic|MedicalOrganization|Hospital|Physician|LocalBusiness|Organization)/i.test(t));

    const strongObserved = <T>(predicate: (p: PageData) => boolean) => {
        const observedPages = validPages.filter(predicate);
        const strongObservedPages = strongPages.filter(predicate);
        return { observedPages: observedPages.length, strongObservedPages: strongObservedPages.length };
    };

    // ---- Relevance (20) ----
    let relevance = 0;
    {
        const titleHasHospital = strongObserved(p => p.title.includes(hospitalName));
        if (titleHasHospital.observedPages > 0) signals.push('title_has_hospital');
        relevance += scoreByCoverage({ pagesAnalyzed, ...titleHasHospital, basePoints: 6 });

        const titleHasKeyword = strongObserved(p => containsAny(p.title, keywordList));
        if (titleHasKeyword.observedPages > 0) signals.push('title_has_keyword');
        relevance += scoreByCoverage({ pagesAnalyzed, ...titleHasKeyword, basePoints: 4 });

        const h1MatchesKeyword = strongObserved(pageH1HasKeyword);
        if (h1MatchesKeyword.observedPages > 0) signals.push('h1_matches_keyword');
        relevance += scoreByCoverage({ pagesAnalyzed, ...h1MatchesKeyword, basePoints: 4 });

        const bodyTopKeyword = strongObserved(pageBodyTopHasKeyword);
        if (bodyTopKeyword.observedPages > 0) signals.push('body_top_keyword');
        relevance += scoreByCoverage({ pagesAnalyzed, ...bodyTopKeyword, basePoints: 3, minCoverage: 0.3 });

        const servicePage = strongObserved(pageHasAnyKeyword);
        if (servicePage.observedPages > 0) signals.push('has_service_page');
        relevance += scoreByCoverage({ pagesAnalyzed, ...servicePage, basePoints: 3 });

        const locationInfo = strongObserved(p => pageHasContactInfo(p));
        if (locationInfo.observedPages > 0) signals.push('has_location_info');
        relevance += scoreByCoverage({ pagesAnalyzed, ...locationInfo, basePoints: 2, minCoverage: 0.5 });
    }
    relevance = clamp(relevance, 0, 20);

    // ---- Structure (20) ----
    let structure = 0;
    {
        const singleH1 = strongObserved(p => p.h1.length === 1);
        if (singleH1.observedPages > 0) signals.push('good_h1_structure');
        structure += scoreByCoverage({ pagesAnalyzed, ...singleH1, basePoints: 5, minCoverage: 0.3 });

        const richH2 = strongObserved(p => p.h2.length >= 3);
        if (richH2.observedPages > 0) signals.push('rich_h2_structure');
        structure += scoreByCoverage({ pagesAnalyzed, ...richH2, basePoints: 4, minCoverage: 0.3 });

        const enoughContent = strongObserved(p => normalizeText(p.bodyText).length >= 900);
        if (enoughContent.observedPages > 0) signals.push('sufficient_content_length');
        structure += scoreByCoverage({ pagesAnalyzed, ...enoughContent, basePoints: 6, minCoverage: 0.3 });

        const internalLinking = strongObserved(p => p.internalLinks.length >= 6);
        if (internalLinking.observedPages > 0) signals.push('internal_linking_ok');
        structure += scoreByCoverage({ pagesAnalyzed, ...internalLinking, basePoints: 3, minCoverage: 0.5 });

        const headingMix = strongObserved(p => p.h1.length >= 1 && p.h2.length >= 1);
        structure += scoreByCoverage({ pagesAnalyzed, ...headingMix, basePoints: 2, minCoverage: 0.3 });
    }
    structure = clamp(structure, 0, 20);

    // ---- Indexing (20) ----
    let indexing = 0;
    const hasCanonicalAny = validPages.some(p => p.hasCanonical);
    const hasSitemapProxy =
        pages.some(p => /sitemap/i.test(p.url)) || pages.some(p => p.internalLinks.some(l => /sitemap/i.test(l)));
    {
        const metaDesc = strongObserved(p => normalizeText(p.description).length >= 30);
        if (metaDesc.observedPages > 0) signals.push('has_meta_description');
        indexing += scoreByCoverage({ pagesAnalyzed, ...metaDesc, basePoints: 5, minCoverage: 0.3 });

        const canonical = strongObserved(p => p.hasCanonical);
        if (canonical.observedPages > 0) signals.push('has_canonical');
        indexing += scoreByCoverage({ pagesAnalyzed, ...canonical, basePoints: 7, minCoverage: 0.3 });

        const sitemap = { observedPages: hasSitemapProxy ? 1 : 0, strongObservedPages: 0 };
        if (hasSitemapProxy) signals.push('has_sitemap_proxy');
        indexing += scoreByCoverage({ pagesAnalyzed, ...sitemap, basePoints: 4 });

        const og = strongObserved(p => p.hasOgTags);
        if (og.observedPages > 0) signals.push('og_ok');
        indexing += scoreByCoverage({ pagesAnalyzed, ...og, basePoints: 2, minCoverage: 0.5 });

        const viewport = strongObserved(p => p.hasViewport);
        if (viewport.observedPages > 0) signals.push('mobile_friendly');
        indexing += scoreByCoverage({ pagesAnalyzed, ...viewport, basePoints: 2, minCoverage: 0.5 });
    }
    indexing = clamp(indexing, 0, 20);

    // ---- Trust (20) ----
    let trust = 0;
    const riskInfoObserved = strongObserved(pageHasRiskInfo);
    {
        const doctor = strongObserved(pageHasDoctorInfo);
        if (doctor.observedPages > 0) signals.push('has_doctor_page');
        trust += scoreByCoverage({ pagesAnalyzed, ...doctor, basePoints: 6, minCoverage: 0.3 });

        const contact = strongObserved(pageHasContactInfo);
        if (contact.observedPages > 0) signals.push('has_basic_info');
        trust += scoreByCoverage({ pagesAnalyzed, ...contact, basePoints: 3, minCoverage: 0.5 });

        if (riskInfoObserved.observedPages > 0) signals.push('has_risk_info');
        trust += scoreByCoverage({ pagesAnalyzed, ...riskInfoObserved, basePoints: 7 });

        const flow = strongObserved(pageHasFlow);
        if (flow.observedPages > 0) signals.push('has_cause_symptom_treatment_flow');
        trust += scoreByCoverage({ pagesAnalyzed, ...flow, basePoints: 4 });
    }
    trust = clamp(trust, 0, 20);

    // ---- FAQ/Schema (20) ----
    let faq_schema = 0;
    const totalFaq = validPages.reduce((sum, p) => sum + (p.faqCount || 0), 0);
    const hasFaqSchemaAny = validPages.some(pageHasFaqSchema);
    const hasMedicalSchemaAny = validPages.some(pageHasMedicalSchema);
    {
        const faqSchema = strongObserved(pageHasFaqSchema);
        if (faqSchema.observedPages > 0) signals.push('has_faq_schema');
        faq_schema += scoreByCoverage({ pagesAnalyzed, ...faqSchema, basePoints: 8 });

        const medicalSchema = strongObserved(pageHasMedicalSchema);
        if (medicalSchema.observedPages > 0) signals.push('has_medical_schema');
        faq_schema += scoreByCoverage({ pagesAnalyzed, ...medicalSchema, basePoints: 6 });

        const faq5 = strongObserved(p => (p.faqCount || 0) >= 5);
        if (faq5.observedPages > 0) signals.push('rich_faq_5plus');
        faq_schema += scoreByCoverage({ pagesAnalyzed, ...faq5, basePoints: 4 });

        const faq3 = strongObserved(p => (p.faqCount || 0) >= 3);
        if (faq3.observedPages > 0) signals.push('faq_3plus');
        faq_schema += scoreByCoverage({ pagesAnalyzed, ...faq3, basePoints: 2 });
    }
    faq_schema = clamp(faq_schema, 0, 20);

    // ---- Caps (A-5) ----
    const caps: ScoreResult['details']['caps'] = {};
    if (!hasSitemapProxy && !hasCanonicalAny) {
        caps.indexingCap = 14;
        indexing = Math.min(indexing, caps.indexingCap);
    }
    if (riskInfoObserved.observedPages === 0) {
        caps.trustCap = 14;
        trust = Math.min(trust, caps.trustCap);
    }
    if (totalFaq < 3 && !hasFaqSchemaAny) {
        caps.totalCap = 80;
    }

    // ---- A-3: confidence adjustment ----
    const rawTotal = relevance + structure + indexing + trust + faq_schema;
    const confidenceFactor = 0.65 + (0.35 * validRatio);

    const scaled = {
        relevance: clamp(Math.round(relevance * confidenceFactor), 0, 20),
        structure: clamp(Math.round(structure * confidenceFactor), 0, 20),
        indexing: clamp(Math.round(indexing * confidenceFactor), 0, 20),
        trust: clamp(Math.round(trust * confidenceFactor), 0, 20),
        faq_schema: clamp(Math.round(faq_schema * confidenceFactor), 0, 20),
    };

    // Re-apply category caps after scaling.
    if (caps.indexingCap !== undefined) scaled.indexing = Math.min(scaled.indexing, caps.indexingCap);
    if (caps.trustCap !== undefined) scaled.trust = Math.min(scaled.trust, caps.trustCap);

    let total = scaled.relevance + scaled.structure + scaled.indexing + scaled.trust + scaled.faq_schema;

    // Apply total cap by proportionally scaling category scores to keep consistency.
    if (caps.totalCap !== undefined && total > caps.totalCap) {
        const factor = caps.totalCap / total;
        scaled.relevance = clamp(Math.round(scaled.relevance * factor), 0, 20);
        scaled.structure = clamp(Math.round(scaled.structure * factor), 0, 20);
        scaled.indexing = clamp(Math.round(scaled.indexing * factor), 0, 20);
        scaled.trust = clamp(Math.round(scaled.trust * factor), 0, 20);
        scaled.faq_schema = clamp(Math.round(scaled.faq_schema * factor), 0, 20);
        total = scaled.relevance + scaled.structure + scaled.indexing + scaled.trust + scaled.faq_schema;
    }

    total = clamp(Math.round(total), 0, 100);

    if (hasFaqSchemaAny) signals.push('cap_guard_faq_schema_ok');
    if (hasMedicalSchemaAny) signals.push('schema_medical_present');
    if (hasSitemapProxy) signals.push('sitemap_proxy_present');

    return {
        total,
        categories: scaled,
        details: {
            signals,
            metrics: {
                pagesAnalyzed,
                validPages: validPagesCount,
                validRatio: Number(validRatio.toFixed(3)),
                strongPages: strongPagesCount,
            },
            caps,
        },
    };
}

