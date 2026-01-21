import { PageData, ScoreResult, ScoreCheckItem } from './types';

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

type CategoryKey = 'relevance' | 'structure' | 'indexing' | 'trust' | 'faq_schema';

interface CheckCandidate extends ScoreCheckItem {
    weight: number;
    coverage: number;
}

function weightedCoverage(pagesAnalyzed: number, observedPages: number, strongObservedPages: number = 0): number {
    if (pagesAnalyzed <= 0) return 0;
    const weightedObserved = Math.min(pagesAnalyzed, observedPages + (strongObservedPages * 0.5));
    return weightedObserved / pagesAnalyzed;
}

function makeCheckCandidate(args: {
    key: string;
    label: string;
    pagesAnalyzed: number;
    observedPages: number;
    strongObservedPages?: number;
    okMinCoverage?: number;
    weight: number;
}): CheckCandidate {
    const { key, label, pagesAnalyzed, observedPages, strongObservedPages = 0, okMinCoverage, weight } = args;
    const coverage = weightedCoverage(pagesAnalyzed, observedPages, strongObservedPages);
    const ok = okMinCoverage === undefined ? observedPages > 0 : coverage >= okMinCoverage;
    return { key, label, ok, weight, coverage };
}

function pickFourChecks(candidates: CheckCandidate[]): ScoreCheckItem[] {
    const fails = candidates
        .filter(c => !c.ok)
        .sort((a, b) => (b.weight - a.weight) || (a.coverage - b.coverage));
    const passes = candidates
        .filter(c => c.ok)
        .sort((a, b) => (b.weight - a.weight) || (b.coverage - a.coverage));

    const chosen: CheckCandidate[] = [];
    chosen.push(...fails.slice(0, 2));
    chosen.push(...passes.slice(0, 2));

    if (chosen.length < 4) {
        const remaining = [...fails.slice(2), ...passes.slice(2)];
        for (const c of remaining) {
            if (chosen.length >= 4) break;
            if (!chosen.some(x => x.key === c.key)) chosen.push(c);
        }
    }

    return chosen.slice(0, 4).map(({ key, ok, label }) => ({ key, ok, label }));
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
    const checkCandidates: Record<CategoryKey, CheckCandidate[]> = {
        relevance: [],
        structure: [],
        indexing: [],
        trust: [],
        faq_schema: [],
    };

    const labels =
        locale === 'ko'
            ? {
                titleKeyword: 'Title에 진료 키워드 포함',
                titleHospital: 'Title에 병원명 포함',
                h1Keyword: 'H1에 진료 키워드 포함',
                servicePage: '진료/시술 페이지 존재',
                locationInfo: '주소/전화/진료시간 표기',
                metaDescription: '메타 설명(meta) 충분',
                canonical: 'canonical 존재',
                sitemap: 'sitemap 존재',
                ogTags: 'OG 태그 존재',
                viewport: '모바일 viewport 설정',
                singleH1: 'H1 1개 구조 유지',
                richH2: 'H2 3개 이상 구성',
                contentLength: '본문 길이(900자+) 확보',
                internalLinks: '내부 링크 충분',
                headingMix: '헤딩 계층(H1/H2) 구성',
                doctorInfo: '의료진/자격 정보 확인',
                contactInfo: '연락처/진료시간 확인',
                riskInfo: '부작용/주의/사후관리 단서',
                semanticFlow: '원인-증상-치료 흐름 단서',
                faqSchema: 'FAQPage 스키마 존재',
                medicalSchema: 'Medical/Organization 스키마',
                faq5: 'FAQ 5문항 이상 페이지',
                faq3: 'FAQ 3문항 이상 페이지',
            }
            : {
                titleKeyword: 'Titleに診療キーワードを含む',
                titleHospital: 'Titleに医院名を含む',
                h1Keyword: 'H1に診療キーワードを含む',
                servicePage: '診療/施術ページが存在',
                locationInfo: '住所/電話/診療時間の表記',
                metaDescription: 'メタ説明(meta)が十分',
                canonical: 'canonicalが存在',
                sitemap: 'sitemapが存在',
                ogTags: 'OGタグが存在',
                viewport: 'モバイルviewport設定',
                singleH1: 'H1が1つの構造',
                richH2: 'H2が3つ以上',
                contentLength: '本文量(900字+)を確保',
                internalLinks: '内部リンクが十分',
                headingMix: '見出し階層(H1/H2)を構成',
                doctorInfo: '医師/資格情報の記載',
                contactInfo: '連絡先/診療時間の記載',
                riskInfo: '副作用/注意/アフターケア',
                semanticFlow: '原因-症状-治療の流れ',
                faqSchema: 'FAQPageスキーマが存在',
                medicalSchema: 'Medical/Organizationスキーマ',
                faq5: 'FAQが5問以上のページ',
                faq3: 'FAQが3問以上のページ',
            };

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
        checkCandidates.relevance.push(
            makeCheckCandidate({ key: 'title_has_hospital', label: labels.titleHospital, pagesAnalyzed, ...titleHasHospital, okMinCoverage: 0.1, weight: 2 })
        );

        const titleHasKeyword = strongObserved(p => containsAny(p.title, keywordList));
        if (titleHasKeyword.observedPages > 0) signals.push('title_has_keyword');
        relevance += scoreByCoverage({ pagesAnalyzed, ...titleHasKeyword, basePoints: 4 });
        checkCandidates.relevance.push(
            makeCheckCandidate({ key: 'title_has_keyword', label: labels.titleKeyword, pagesAnalyzed, ...titleHasKeyword, okMinCoverage: 0.3, weight: 3 })
        );

        const h1MatchesKeyword = strongObserved(pageH1HasKeyword);
        if (h1MatchesKeyword.observedPages > 0) signals.push('h1_matches_keyword');
        relevance += scoreByCoverage({ pagesAnalyzed, ...h1MatchesKeyword, basePoints: 4 });
        checkCandidates.relevance.push(
            makeCheckCandidate({ key: 'h1_matches_keyword', label: labels.h1Keyword, pagesAnalyzed, ...h1MatchesKeyword, okMinCoverage: 0.3, weight: 3 })
        );

        const bodyTopKeyword = strongObserved(pageBodyTopHasKeyword);
        if (bodyTopKeyword.observedPages > 0) signals.push('body_top_keyword');
        relevance += scoreByCoverage({ pagesAnalyzed, ...bodyTopKeyword, basePoints: 3, minCoverage: 0.3 });

        const servicePage = strongObserved(pageHasAnyKeyword);
        if (servicePage.observedPages > 0) signals.push('has_service_page');
        relevance += scoreByCoverage({ pagesAnalyzed, ...servicePage, basePoints: 3 });
        checkCandidates.relevance.push(
            makeCheckCandidate({ key: 'has_service_page', label: labels.servicePage, pagesAnalyzed, ...servicePage, okMinCoverage: 0.1, weight: 4 })
        );

        const locationInfo = strongObserved(p => pageHasContactInfo(p));
        if (locationInfo.observedPages > 0) signals.push('has_location_info');
        relevance += scoreByCoverage({ pagesAnalyzed, ...locationInfo, basePoints: 2, minCoverage: 0.5 });
        checkCandidates.relevance.push(
            makeCheckCandidate({ key: 'has_location_info', label: labels.locationInfo, pagesAnalyzed, ...locationInfo, okMinCoverage: 0.5, weight: 1 })
        );
    }
    relevance = clamp(relevance, 0, 20);

    // ---- Structure (20) ----
    let structure = 0;
    {
        const singleH1 = strongObserved(p => p.h1.length === 1);
        if (singleH1.observedPages > 0) signals.push('good_h1_structure');
        structure += scoreByCoverage({ pagesAnalyzed, ...singleH1, basePoints: 5, minCoverage: 0.3 });
        checkCandidates.structure.push(
            makeCheckCandidate({ key: 'good_h1_structure', label: labels.singleH1, pagesAnalyzed, ...singleH1, okMinCoverage: 0.3, weight: 3 })
        );

        const richH2 = strongObserved(p => p.h2.length >= 3);
        if (richH2.observedPages > 0) signals.push('rich_h2_structure');
        structure += scoreByCoverage({ pagesAnalyzed, ...richH2, basePoints: 4, minCoverage: 0.3 });
        checkCandidates.structure.push(
            makeCheckCandidate({ key: 'rich_h2_structure', label: labels.richH2, pagesAnalyzed, ...richH2, okMinCoverage: 0.3, weight: 2 })
        );

        const enoughContent = strongObserved(p => normalizeText(p.bodyText).length >= 900);
        if (enoughContent.observedPages > 0) signals.push('sufficient_content_length');
        structure += scoreByCoverage({ pagesAnalyzed, ...enoughContent, basePoints: 6, minCoverage: 0.3 });
        checkCandidates.structure.push(
            makeCheckCandidate({ key: 'sufficient_content_length', label: labels.contentLength, pagesAnalyzed, ...enoughContent, okMinCoverage: 0.3, weight: 4 })
        );

        const internalLinking = strongObserved(p => p.internalLinks.length >= 6);
        if (internalLinking.observedPages > 0) signals.push('internal_linking_ok');
        structure += scoreByCoverage({ pagesAnalyzed, ...internalLinking, basePoints: 3, minCoverage: 0.5 });
        checkCandidates.structure.push(
            makeCheckCandidate({ key: 'internal_linking_ok', label: labels.internalLinks, pagesAnalyzed, ...internalLinking, okMinCoverage: 0.5, weight: 1 })
        );

        const headingMix = strongObserved(p => p.h1.length >= 1 && p.h2.length >= 1);
        structure += scoreByCoverage({ pagesAnalyzed, ...headingMix, basePoints: 2, minCoverage: 0.3 });
        checkCandidates.structure.push(
            makeCheckCandidate({ key: 'heading_hierarchy_ok', label: labels.headingMix, pagesAnalyzed, ...headingMix, okMinCoverage: 0.3, weight: 2 })
        );
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
        checkCandidates.indexing.push(
            makeCheckCandidate({ key: 'has_meta_description', label: labels.metaDescription, pagesAnalyzed, ...metaDesc, okMinCoverage: 0.3, weight: 2 })
        );

        const canonical = strongObserved(p => p.hasCanonical);
        if (canonical.observedPages > 0) signals.push('has_canonical');
        indexing += scoreByCoverage({ pagesAnalyzed, ...canonical, basePoints: 7, minCoverage: 0.3 });
        checkCandidates.indexing.push(
            makeCheckCandidate({ key: 'has_canonical', label: labels.canonical, pagesAnalyzed, ...canonical, okMinCoverage: 0.3, weight: 4 })
        );

        const sitemap = { observedPages: hasSitemapProxy ? 1 : 0, strongObservedPages: 0 };
        if (hasSitemapProxy) signals.push('has_sitemap');
        indexing += scoreByCoverage({ pagesAnalyzed, ...sitemap, basePoints: 4 });
        checkCandidates.indexing.push(
            makeCheckCandidate({ key: 'has_sitemap', label: labels.sitemap, pagesAnalyzed, ...sitemap, okMinCoverage: 0.01, weight: 3 })
        );

        const og = strongObserved(p => p.hasOgTags);
        if (og.observedPages > 0) signals.push('og_ok');
        indexing += scoreByCoverage({ pagesAnalyzed, ...og, basePoints: 2, minCoverage: 0.5 });
        checkCandidates.indexing.push(
            makeCheckCandidate({ key: 'og_ok', label: labels.ogTags, pagesAnalyzed, ...og, okMinCoverage: 0.5, weight: 1 })
        );

        const viewport = strongObserved(p => p.hasViewport);
        if (viewport.observedPages > 0) signals.push('viewport_ok');
        indexing += scoreByCoverage({ pagesAnalyzed, ...viewport, basePoints: 2, minCoverage: 0.5 });
        checkCandidates.indexing.push(
            makeCheckCandidate({ key: 'viewport_ok', label: labels.viewport, pagesAnalyzed, ...viewport, okMinCoverage: 0.5, weight: 1 })
        );
    }
    indexing = clamp(indexing, 0, 20);

    // ---- Trust (20) ----
    let trust = 0;
    const riskInfoObserved = strongObserved(pageHasRiskInfo);
    {
        const doctor = strongObserved(pageHasDoctorInfo);
        if (doctor.observedPages > 0) signals.push('has_doctor_page');
        trust += scoreByCoverage({ pagesAnalyzed, ...doctor, basePoints: 6, minCoverage: 0.3 });
        checkCandidates.trust.push(
            makeCheckCandidate({ key: 'has_doctor_page', label: labels.doctorInfo, pagesAnalyzed, ...doctor, okMinCoverage: 0.3, weight: 3 })
        );

        const contact = strongObserved(pageHasContactInfo);
        if (contact.observedPages > 0) signals.push('has_contact_hours_phone');
        trust += scoreByCoverage({ pagesAnalyzed, ...contact, basePoints: 3, minCoverage: 0.5 });
        checkCandidates.trust.push(
            makeCheckCandidate({ key: 'has_contact_hours_phone', label: labels.contactInfo, pagesAnalyzed, ...contact, okMinCoverage: 0.5, weight: 1 })
        );

        if (riskInfoObserved.observedPages > 0) signals.push('has_risk_info');
        trust += scoreByCoverage({ pagesAnalyzed, ...riskInfoObserved, basePoints: 7 });
        checkCandidates.trust.push(
            makeCheckCandidate({ key: 'has_risk_info', label: labels.riskInfo, pagesAnalyzed, ...riskInfoObserved, okMinCoverage: 0.1, weight: 5 })
        );

        const flow = strongObserved(pageHasFlow);
        if (flow.observedPages > 0) signals.push('has_cause_symptom_treatment_flow');
        trust += scoreByCoverage({ pagesAnalyzed, ...flow, basePoints: 4 });
        if (flow.observedPages > 0) signals.push('semantic_flow_ok');
        checkCandidates.trust.push(
            makeCheckCandidate({ key: 'semantic_flow_ok', label: labels.semanticFlow, pagesAnalyzed, ...flow, okMinCoverage: 0.1, weight: 4 })
        );
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
        checkCandidates.faq_schema.push(
            makeCheckCandidate({ key: 'has_faq_schema', label: labels.faqSchema, pagesAnalyzed, ...faqSchema, okMinCoverage: 0.01, weight: 5 })
        );

        const medicalSchema = strongObserved(pageHasMedicalSchema);
        if (medicalSchema.observedPages > 0) signals.push('has_medical_schema');
        faq_schema += scoreByCoverage({ pagesAnalyzed, ...medicalSchema, basePoints: 6 });
        checkCandidates.faq_schema.push(
            makeCheckCandidate({ key: 'has_medical_schema', label: labels.medicalSchema, pagesAnalyzed, ...medicalSchema, okMinCoverage: 0.01, weight: 4 })
        );

        const faq5 = strongObserved(p => (p.faqCount || 0) >= 5);
        if (faq5.observedPages > 0) signals.push('rich_faq_5plus');
        faq_schema += scoreByCoverage({ pagesAnalyzed, ...faq5, basePoints: 4 });
        checkCandidates.faq_schema.push(
            makeCheckCandidate({ key: 'faq_count_5plus', label: labels.faq5, pagesAnalyzed, ...faq5, okMinCoverage: 0.1, weight: 3 })
        );

        const faq3 = strongObserved(p => (p.faqCount || 0) >= 3);
        if (faq3.observedPages > 0) signals.push('faq_3plus');
        faq_schema += scoreByCoverage({ pagesAnalyzed, ...faq3, basePoints: 2 });
        checkCandidates.faq_schema.push(
            makeCheckCandidate({ key: 'faq_count_3plus', label: labels.faq3, pagesAnalyzed, ...faq3, okMinCoverage: 0.1, weight: 2 })
        );
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
    if (hasSitemapProxy) signals.push('sitemap_present');

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
            checks: {
                relevance: pickFourChecks(checkCandidates.relevance),
                structure: pickFourChecks(checkCandidates.structure),
                indexing: pickFourChecks(checkCandidates.indexing),
                trust: pickFourChecks(checkCandidates.trust),
                faq_schema: pickFourChecks(checkCandidates.faq_schema),
            },
            caps,
        },
    };
}
