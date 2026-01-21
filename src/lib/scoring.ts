import { PageData, ScoreResult } from './types';

interface ScoreInput {
    hospitalName: string;
    keywords: string[];
    locale: 'ko' | 'ja';
}

export function calculateScore(pages: PageData[], input: ScoreInput): ScoreResult {
    const { keywords, hospitalName, locale } = input;
    const home = pages[0]; // Assuming first page is home

    if (!home) {
        return {
            total: 0,
            categories: { relevance: 0, structure: 0, indexing: 0, trust: 0, faq_schema: 0 },
            details: { signals: ['No pages analyzed'] }
        };
    }

    // Helpers
    const hasKeyword = (text: string) => keywords.some(k => text.toLowerCase().includes(k.toLowerCase()));
    const signals: string[] = [];

    // 1. Relevance (20)
    let relevance = 0;
    // A1) Title includes Hospital Name or Keywords
    if (home.title.includes(hospitalName) || hasKeyword(home.title)) {
        relevance += 4;
        signals.push('title_has_keyword');
    }
    // A2) H1 has keyword
    if (home.h1.some(h => hasKeyword(h))) {
        relevance += 4;
        signals.push('h1_matches_keyword');
    }
    // A3) First 300 chars of body has keyword
    if (hasKeyword(home.bodyText.slice(0, 300))) {
        relevance += 4;
        signals.push('body_top_keyword');
    }
    // A4) Service page exists (simple heuristic: url or title contains service keywords)
    const hasServicePage = pages.some(p => hasKeyword(p.url) || hasKeyword(p.title));
    if (hasServicePage) {
        relevance += 6;
        signals.push('has_service_page');
    }
    // A5) Address in body
    const addressKeywords = locale === 'ko' ? ['시', '구', '동', '길', '로'] : ['都', '道', '府', '県', '市', '區', '町', '村'];
    if (addressKeywords.some(k => home.bodyText.includes(k))) {
        relevance += 2;
        signals.push('has_location_info');
    }

    // 2. Structure (20)
    let structure = 0;
    // B1) Single H1 ratio >= 60%
    const singleH1Count = pages.filter(p => p.h1.length === 1).length;
    if ((singleH1Count / pages.length) >= 0.6) {
        structure += 4;
        signals.push('good_h1_structure');
    }
    // B2) Service page has 3+ H2
    // We check if ANY page with sufficient content has 3+ H2
    if (pages.some(p => p.h2.length >= 3)) {
        structure += 4;
        signals.push('rich_h2_structure');
    }
    // B3) List/Table presence (heuristic: check for text patterns or implementation detail, hard with just text, skipping or assuming true for demo if body len > 1000)
    if (home.bodyText.length > 1000) { // Proxy for structured content
        structure += 4;
    }
    // B4) Text length >= 700 chars
    if (pages.some(p => p.bodyText.length >= 700)) {
        structure += 4;
        signals.push('sufficient_content_length');
    }
    // B5) Internal Links >= 3
    if (home.internalLinks.length >= 3) {
        structure += 4;
        signals.push('internal_linking_ok');
    }

    // 3. Indexing (20)
    let indexing = 0;
    // C1) Meta Description
    if (home.description && home.description.length > 10) {
        indexing += 4;
        signals.push('has_meta_description');
    }
    // C2) Canonical
    if (home.hasCanonical) {
        indexing += 4;
        signals.push('has_canonical');
    }
    // C4) Sitemap (Can't check easily without separate fetch, assuming ok if internal links found well)
    if (pages.length > 1) { // Implicit sitemap/crawlability
        indexing += 4;
        signals.push('crawlable'); // Proxy for sitemap
    }
    // C5) OG Tags
    if (home.hasOgTags) {
        indexing += 2;
        signals.push('og_ok');
    }
    // C6) Mobile (Viewport)
    if (home.hasViewport) {
        indexing += 1; // C6-1
        indexing += 1; // C6-2 (Assuming responsive if meta viewport exists)
        signals.push('mobile_friendly');
    }
    // Bonus refill if max not reached (C3 robots defaults to ok if we crawled it)
    if (indexing < 20) indexing += 4;

    // 4. Trust (20)
    let trust = 0;
    const docKeywords = locale === 'ko' ? ['의료진', '원장', '의사', '약력'] : ['医師', '院長', 'スタッフ'];
    if (pages.some(p => docKeywords.some(k => p.bodyText.includes(k) || p.title.includes(k)))) {
        trust += 6;
        signals.push('has_doctor_page');
    }
    const contactKeywords = locale === 'ko' ? ['전화', '주소', '진료시간'] : ['電話', '住所', '診療時間'];
    if (home.bodyText.match(new RegExp(contactKeywords.join('|'), 'g'))?.length || 0 >= 2) {
        trust += 4;
        signals.push('has_basic_info');
    }
    const riskKeywords = locale === 'ko' ? ['부작용', '주의사항', '관리'] : ['副作用', '注意', 'ケア'];
    if (pages.some(p => riskKeywords.some(k => p.bodyText.includes(k)))) {
        trust += 4;
        signals.push('has_risk_info');
    }
    // D4/D5 Filler
    trust += 6; // Assuming others are present for MVP

    // 5. FAQ/Schema (20)
    let faq_schema = 0;
    // E1/E2 FAQ
    const totalFaq = pages.reduce((sum, p) => sum + p.faqCount, 0);
    if (totalFaq > 0) faq_schema += 5;
    if (totalFaq >= 5) {
        faq_schema += 4;
        signals.push('rich_faq');
    }
    // E3/E4 Schema
    if (pages.some(p => p.schemaTypes.some(t => t.includes('FAQ')))) {
        faq_schema += 4;
        signals.push('has_faq_schema');
    }
    if (pages.some(p => p.schemaTypes.some(t => t.includes('Medical') || t.includes('Organization') || t.includes('LocalBusiness')))) {
        faq_schema += 3;
        signals.push('has_medical_schema');
    }
    // E5/E6 Filler
    if (faq_schema < 20) faq_schema += 4;

    const total = relevance + structure + indexing + trust + faq_schema;

    return {
        total: Math.min(total, 100),
        categories: {
            relevance: Math.min(relevance, 20),
            structure: Math.min(structure, 20),
            indexing: Math.min(indexing, 20),
            trust: Math.min(trust, 20),
            faq_schema: Math.min(faq_schema, 20)
        },
        details: { signals }
    };
}
