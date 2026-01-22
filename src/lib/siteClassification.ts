import { PageData, SiteClassification } from './types';

function normalizeText(text: string): string {
    return (text || '').replace(/\s+/g, ' ').trim();
}

function containsAny(text: string, needles: string[]): boolean {
    const hay = text.toLowerCase();
    return needles.some(n => hay.includes(n.toLowerCase()));
}

function isValidPageForClassification(page: PageData): boolean {
    const bodyLen = normalizeText(page.bodyText).length;
    const hasTitle = normalizeText(page.title).length > 0;
    const hasH1 = page.h1.length > 0;
    const hasH2 = page.h2.length > 0;

    if (bodyLen >= 300) return true;
    if (hasTitle && (hasH1 || hasH2)) return true;
    if (hasH1) return true;
    return false;
}

function clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
}

export function classifySite(pages: PageData[], locale: 'ko' | 'ja'): SiteClassification {
    const validPages = pages.filter(isValidPageForClassification);
    const validPagesCount = validPages.length;

    const medicalKeywords =
        locale === 'ko'
            ? ['병원', '의원', '클리닉', '진료', '시술', '치료', '의료진', '의사', '전문의', '예약', '상담', '내원', '부작용', '회복', '비용', '가격']
            : ['病院', 'クリニック', '診療', '施術', '治療', '医師', '専門医', '予約', '相談', '来院', '副作用', '回復', '費用', '料金'];

    const structureKeywords =
        locale === 'ko'
            ? ['진료시간', '오시는길', 'FAQ', '문의', '전화']
            : ['診療時間', 'アクセス', 'FAQ', 'よくある質問', 'お問い合わせ', '電話'];

    const nonHospitalCore =
        locale === 'ko'
            ? ['채용', '인재', 'IR', '회사소개', '기업', '쇼핑', '구매', '장바구니', '카트', '결제', '제품']
            : ['採用', '求人', 'IR', '会社概要', '企業', '購入', 'カート', '決済', '製品'];

    const combinedText = (p: PageData) =>
        `${p.title}\n${p.h1.join(' ')}\n${p.h2.join(' ')}\n${normalizeText(p.bodyText)}`.trim();

    const medicalCoverage = validPages.filter(p => containsAny(combinedText(p), medicalKeywords)).length;
    const structureCoverage = validPages.filter(p => containsAny(combinedText(p), structureKeywords)).length;
    const nonHospitalCoverage = validPages.filter(p => containsAny(combinedText(p), nonHospitalCore)).length;

    let score = 0;
    const evidence: string[] = [];

    // (A) medical keywords coverage
    if (medicalCoverage >= 5) score += 6;
    else if (medicalCoverage >= 3) score += 4;
    else if (medicalCoverage >= 1) score += 2;

    // (B) structure keywords coverage
    if (structureCoverage >= 3) score += 2;
    else if (structureCoverage >= 1) score += 1;

    // (C) schema signal
    const medicalSchemaTypes = ['MedicalClinic', 'Physician', 'Dentist', 'Hospital', 'MedicalBusiness'];
    const schemaHit = validPages.some(p => p.schemaTypes.some(t => medicalSchemaTypes.some(mt => t.includes(mt))));
    const orgOrLocalWithMedical = validPages.some(p => {
        const hasOrgOrLocal = p.schemaTypes.some(t => /(LocalBusiness|Organization)/i.test(t));
        if (!hasOrgOrLocal) return false;
        return containsAny(combinedText(p), medicalKeywords);
    });
    if (schemaHit || orgOrLocalWithMedical) score += 3;

    // (D) repetition bonus
    if (medicalCoverage >= 3) score += 1;

    // (E) non-hospital penalty
    let penalty = 0;
    if (nonHospitalCoverage >= 2) penalty = -2;
    score += penalty;

    score = clamp(score, 0, 10);

    // (2-4) level decision
    let level: SiteClassification['level'] = score >= 6 ? 'yes' : score >= 4 ? 'uncertain' : 'no';
    if (validPagesCount < 3 && level === 'no') level = 'uncertain';

    evidence.push(`medical_keyword_coverage=${medicalCoverage}`);
    evidence.push(`structure_keyword_coverage=${structureCoverage}`);
    evidence.push(`schema_medical=${schemaHit || orgOrLocalWithMedical}`);
    evidence.push(`non_hospital_penalty=${penalty}`);
    evidence.push(`validPages=${validPagesCount}`);

    return {
        isHospital: level === 'yes',
        level,
        evidenceScore: score,
        evidence,
        validPages: validPagesCount,
    };
}

