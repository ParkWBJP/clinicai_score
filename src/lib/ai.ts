import OpenAI from 'openai';
import { ScoreResult, PageData } from './types';

function getOpenAIApiKey(): string | undefined {
    // Vercel/Next users sometimes (incorrectly) store secrets under NEXT_PUBLIC_*
    // Support it server-side as a fallback to reduce deployment mismatches.
    return process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY;
}

export type AIGenerationStatus = 'ok' | 'missing_key' | 'error';

export interface AIGenerationMeta {
    status: AIGenerationStatus;
    message?: string;
}

export interface AIReport {
    overview_summary: string;
    overview_clinicai: string;
    overview_priorities: string[];
    card_overviews: {
        relevance: string;
        structure: string;
        indexing: string;
        trust: string;
        faq_schema: string;
    };
}

export interface AIGenerationResult {
    report: AIReport;
    meta: AIGenerationMeta;
}

function buildTextSnippet(text: string, keywords: string[]): string {
    const normalized = (text || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return '';

    const minLen = 400;
    const maxLen = 700;

    const candidates: Array<{ start: number; score: number }> = [];

    const pushCandidate = (start: number, score: number) => {
        const clamped = Math.max(0, Math.min(start, Math.max(0, normalized.length - minLen)));
        candidates.push({ start: clamped, score });
    };

    // Prefer likely "explanatory" sections; also bias toward keyword hits.
    const sectionHints = ['faq', 'q.', 'question', '질문', '진료', '치료', '예약', '비용', '料金', '診療', '治療', '予約'];
    for (const hint of sectionHints) {
        const idx = normalized.toLowerCase().indexOf(hint.toLowerCase());
        if (idx >= 0) pushCandidate(Math.max(0, idx - 120), 3);
    }

    for (const keyword of keywords.map(k => k.trim()).filter(Boolean)) {
        const idx = normalized.toLowerCase().indexOf(keyword.toLowerCase());
        if (idx >= 0) pushCandidate(Math.max(0, idx - 120), 5);
    }

    // Always include the top of the page as a fallback.
    pushCandidate(0, 1);

    candidates.sort((a, b) => b.score - a.score);
    const start = candidates[0]?.start ?? 0;
    const slice = normalized.slice(start, start + maxLen);

    if (slice.length >= minLen) return slice;
    return normalized.slice(0, Math.min(normalized.length, maxLen));
}

function ensureConservativeNote(report: AIReport, locale: 'ko' | 'ja') {
    const note =
        locale === 'ko'
            ? '일부 페이지는 사이트 제한으로 수집되지 않아 결과는 보수적으로 산정되었습니다.'
            : '一部ページはサイト側の制限により取得できず、結果は保守的に算出しています。';

    if (!report.overview_summary.includes(note)) {
        report.overview_summary = `${report.overview_summary.trim()} ${note}`.trim();
    }
}

function safeParseJsonReport(raw: string): AIReport {
    const parsed = JSON.parse(raw) as Partial<AIReport>;
    if (!parsed || typeof parsed !== 'object') throw new Error('Invalid JSON');
    if (!parsed.overview_summary || !parsed.overview_clinicai || !Array.isArray(parsed.overview_priorities) || !parsed.card_overviews) {
        throw new Error('Missing fields in AI report');
    }
    return parsed as AIReport;
}

export async function generateAIReport(
    score: ScoreResult,
    pages: PageData[],
    hospitalName: string,
    address: string,
    keywords: string[],
    locale: 'ko' | 'ja'
): Promise<AIGenerationResult> {
    const apiKey = getOpenAIApiKey();
    if (!apiKey) {
        console.warn('OpenAI API Key missing, returning fallback report.');
        const report = getFallbackReport(locale);
        if (pages.length < 3) ensureConservativeNote(report, locale);
        return {
            report,
            meta: { status: 'missing_key', message: 'OPENAI_API_KEY is not set (check Vercel Environment Variables and redeploy)' },
        };
    }

    const openai = new OpenAI({ apiKey });

    const systemPrompt = `You are a professional web auditor for Clinic.ai. You analyze hospital websites to improve their patient acquisition efficiency.
    - Tone: Professional, Constructive, "Consulting Report" style. No medical advice.
    - Goal: Highlight opportunities for improvement rather than just criticizing faults.
    - Output: ONLY JSON. No markdown.
    - No hallucination: Use ONLY the provided Input JSON (snippets/scores/signals). If evidence is insufficient, explicitly say so.
    - Language: ${locale === 'ko' ? 'Korean (Professional/Polite)' : 'Japanese (Business Keigo/Teineigo)'}.`;

    const instructions =
        locale === 'ko'
            ? `1. overview_summary (2~3 sentences): Summarize the site health based on 5 categories (Relevance, Structure, Indexing, Trust, FAQ). Focus on "opportunities to gain" if fixed.
        - Make it feel like you actually read the site by reflecting 1~2 concrete cues from text_snippet(s) or page titles/H1.
        - Do NOT invent facts beyond snippet/signals/scores.
    2. overview_clinicai (1 sentence): A persuasive sentence starting or ending with "Clinic.ai" context, emphasizing that optimization will lead to better patient reach or lower costs.
    3. overview_priorities (Array of 3 strings): 3 most impactful actions. Each 30-55 chars. Imperative/Action-oriented. Sorted by impact.
    4. card_overviews (Object with 5 keys): Brief 1-sentence assessment for each category.`
            : `1. overview_summary (2~3 sentences): Based on 5 categories (Relevance, Structure, Indexing, Trust, FAQ), summarize site health and emphasize opportunities gained by fixing issues.
        - Make it feel like you actually read the site by reflecting 1~2 concrete cues from text_snippet(s) or page titles/H1.
        - Do NOT invent facts beyond snippet/signals/scores.
    2. overview_clinicai (1 sentence): A persuasive sentence referencing Clinic.ai, emphasizing improved patient reach or lower costs.
    3. overview_priorities (Array of 3 strings): 3 most impactful actions. Each ~30-55 chars. Imperative/action-oriented. Sorted by impact.
    4. card_overviews (Object with 5 keys): Brief 1-sentence assessment for each category.`;

    const top_findings = pages.slice(0, 6).map(p => ({
        title: p.title,
        meta_description: p.description || undefined,
        h1: p.h1.slice(0, 2),
        h2: p.h2.slice(0, 3),
        text_snippet: buildTextSnippet(p.bodyText, keywords),
    }));

    const inputJson = JSON.stringify({
        user_input: { hospital_name: hospitalName, address, keywords },
        analysis_meta: { analyzed_pages_count: pages.length, max_pages: 10 },
        signals: score.details.signals,
        scores: { total_score: score.total, category_scores: score.categories },
        top_findings,
    });

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `${instructions}\n\nInput JSON:\n${inputJson}` },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.4,
            max_tokens: 1000,
        });

        const content = response.choices[0].message.content;
        if (!content) throw new Error('No content');

        const report = safeParseJsonReport(content);
        if (pages.length < 3) ensureConservativeNote(report, locale);
        return { report, meta: { status: 'ok' } };
    } catch (error) {
        console.error('AI Generation Failed:', error);
        const report = getFallbackReport(locale);
        if (pages.length < 3) ensureConservativeNote(report, locale);
        return {
            report,
            meta: { status: 'error', message: error instanceof Error ? error.message : 'AI generation failed' },
        };
    }
}

function getFallbackReport(locale: 'ko' | 'ja'): AIReport {
    if (locale === 'ko') {
        return {
            overview_summary:
                'AI 요약 생성이 제한되어 규칙 기반 점검 결과를 중심으로 요약합니다. 관련성/색인/신뢰 요소를 우선 보강하면 환자 유치 효율을 개선할 수 있습니다.',
            overview_clinicai: 'Clinic.ai와 함께 사이트 구조와 SEO 신호를 정비하면 더 많은 잠재 환자에게 도달하고 비용을 절감할 수 있습니다.',
            overview_priorities: [
                '메인 페이지의 Title/H1에 진료과·지역 키워드를 반영하세요.',
                '진료과별 상세 페이지에 FAQ 섹션과 스키마를 추가하세요.',
                '색인(robots/sitemap/canonical) 신호를 점검하고 보완하세요.',
            ],
            card_overviews: {
                relevance: '핵심 키워드(진료과/지역)와 페이지 주제 일치도를 높일 여지가 있습니다.',
                structure: '헤딩(H1-H2) 계층과 내부 링크 구조를 정리하면 탐색성과 이해도가 개선됩니다.',
                indexing: '메타/캐노니컬/사이트맵 등 색인 신호를 점검하면 노출 기회를 늘릴 수 있습니다.',
                trust: '의료진·진료시간·연락처 등 신뢰 정보를 더 명확히 제시할 필요가 있습니다.',
                faq_schema: 'FAQ 콘텐츠와 구조화 데이터(FAQPage 등)를 보강하면 검색 가시성이 좋아집니다.',
            },
        };
    }

    return {
        overview_summary:
            'AI要約の生成が制限されているため、ルールベースの点検結果を中心に要約します。関連性・インデックス・信頼性の要素を優先して強化すると、集患効率の改善が期待できます。',
        overview_clinicai:
            'Clinic.aiとともにサイト構造とSEOシグナルを整備することで、より多くの潜在患者に届き、コストの最適化につながります。',
        overview_priorities: [
            'トップのTitle/H1に診療科・地域キーワードを反映してください。',
            '診療科別ページにFAQとスキーマ(FAQPage)を追加してください。',
            'インデックス(robots/sitemap/canonical)信号を点検してください。',
        ],
        card_overviews: {
            relevance: '診療科・地域キーワードとページ主題の整合性を高める余地があります。',
            structure: '見出し(H1-H2)の階層と内部リンクを整理すると理解しやすくなります。',
            indexing: 'メタ情報やcanonical・サイトマップなどの信号を点検すると露出機会が増えます。',
            trust: '医師/診療時間/連絡先などの信頼情報をより明確に提示する必要があります。',
            faq_schema: 'FAQコンテンツと構造化データ(FAQPage等)の強化が有効です。',
        },
    };
}
