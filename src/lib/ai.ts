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

function normalizeText(text: string): string {
    return (text || '').replace(/\s+/g, ' ').trim();
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

function safeParseJsonReport(raw: string): AIReport {
    const parsed = JSON.parse(raw) as Partial<AIReport>;
    if (!parsed || typeof parsed !== 'object') throw new Error('Invalid JSON');
    if (!parsed.overview_summary || !parsed.overview_clinicai || !Array.isArray(parsed.overview_priorities) || !parsed.card_overviews) {
        throw new Error('Missing fields in AI report');
    }
    return parsed as AIReport;
}

function tryParseJsonReport(raw: string): AIReport {
    try {
        return safeParseJsonReport(raw);
    } catch {
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return safeParseJsonReport(raw.slice(start, end + 1));
        }
        throw new Error('Invalid JSON');
    }
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
        return {
            report,
            meta: { status: 'missing_key', message: 'OPENAI_API_KEY is not set (check Vercel Environment Variables and redeploy)' },
        };
    }

    const openai = new OpenAI({ apiKey });
    const model = 'gpt-5-mini';

    const systemPrompt = `You are a professional web auditor for Clinic.ai. You analyze hospital websites to improve their patient acquisition efficiency.
    - Tone: Professional, Constructive, "Consulting Report" style. No medical advice.
    - Goal: Highlight opportunities for improvement rather than just criticizing faults.
    - Output: ONLY JSON. No markdown.
    - No hallucination: Use ONLY the provided Input JSON (snippets/scores/signals). If evidence is insufficient, explicitly say so.
    - Language: ${locale === 'ko' ? 'Korean (Professional/Polite)' : 'Japanese (Business Keigo/Teineigo)'}.`;

    const instructions =
        locale === 'ko'
            ? `You must output a single JSON object with keys: overview_summary, overview_clinicai, overview_priorities, card_overviews.

overview_summary (KO, 4~6 sentences, 350~520 characters):
- Sentence 1 MUST include: total_score/100 and analyzed_pages_count/max_pages (e.g., "총점 62/100, 분석 10/10페이지").
- In the body, you MUST mention all 5 categories at least once AND include each category score in the format "관련성 16/20" etc.
- Include 2 observable cues from top_findings (title/h1/text_snippet). Mark them naturally as "관찰된 단서" (short quote or phrase). No invented facts.
- Last sentence: constructive opportunity tone (improve exposure/consult conversions), no blaming.
- If valid_pages_count < 5 OR valid_ratio < 0.5, include exactly 1 sentence: "수집/본문 근거가 제한되어 일부 평가는 보수적으로 작성되었습니다."

overview_clinicai (KO, 1 sentence): Mention Clinic.ai and the expected business impact (reach/cost).

overview_priorities (KO, array of 3 strings, each 30~55 chars):
- Prioritize the lowest category_scores first.
- Use imperative/action style.
- Prefer strong-signal improvements when relevant (FAQPage JSON-LD, Medical/Organization schema, 부작용/주의 섹션, 원인-증상-치료 흐름).

card_overviews (KO, object with 5 keys):
- Each value MUST be 1 sentence.
- Tone by score range (no contradictions):
  - 16~20: 강점/충족/유지
  - 11~15: 보통/개선 여지
  - 0~10: 부족/우선 개선
- If you can, reflect 1 short cue from signals or top_findings; otherwise state "근거 제한" briefly.`
            : `You must output a single JSON object with keys: overview_summary, overview_clinicai, overview_priorities, card_overviews.

overview_summary (JA, 4~6 sentences, 220~320 characters):
- Sentence 1 MUST include: total_score/100 and analyzed_pages_count/max_pages.
- You MUST mention all 5 categories at least once AND include each category score in the format "関連性 16/20" etc.
- Include 2 observable cues from top_findings (title/h1/text_snippet). Mark them as observed cues. No invented facts.
- Last sentence: constructive opportunity tone (exposure/consult conversions), no blaming.
- If valid_pages_count < 5 OR valid_ratio < 0.5, include exactly 1 sentence: "取得/本文の根拠が限られるため、一部は保守的に記載しています。"

overview_clinicai (JA, 1 sentence): Mention Clinic.ai and business impact.

overview_priorities (JA, array of 3 strings, each ~30~55 chars):
- Prioritize the lowest category_scores first.
- Imperative/action style.
- Prefer strong-signal improvements when relevant (FAQPage schema, Medical/Organization schema, 副作用/注意, 原因-症状-治療の流れ).

card_overviews (JA, object with 5 keys):
- Each value MUST be 1 sentence.
- Tone by score range (no contradictions):
  - 16~20: 強み/維持
  - 11~15: 標準/改善余地
  - 0~10: 不足/優先改善
- If you can, reflect 1 short cue from signals or top_findings; otherwise mention evidence limitation briefly.`;

    const top_findings = pages.slice(0, 6).map(p => ({
        title: p.title,
        meta_description: p.description || undefined,
        h1: p.h1.slice(0, 2),
        h2: p.h2.slice(0, 3),
        text_snippet: buildTextSnippet(p.bodyText, keywords),
    }));

    const validPagesCount = score.details.metrics?.validPages ?? pages.filter(p => normalizeText(p.bodyText).length >= 400).length;
    const validRatio = score.details.metrics?.validRatio ?? (pages.length ? validPagesCount / pages.length : 0);

    const inputJson = JSON.stringify({
        user_input: { hospital_name: hospitalName, address, keywords },
        analysis_meta: {
            analyzed_pages_count: pages.length,
            max_pages: 10,
            valid_pages_count: validPagesCount,
            valid_ratio: Number(validRatio.toFixed(3)),
        },
        signals: score.details.signals,
        scores: { total_score: score.total, category_scores: score.categories },
        top_findings,
    });

    try {
        const createOnce = async (useResponseFormat: boolean) => {
            const request: Parameters<typeof openai.chat.completions.create>[0] = {
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `${instructions}\n\nInput JSON:\n${inputJson}` },
                ],
                // gpt-5-* uses `max_completion_tokens` (chat.completions) instead of `max_tokens`
                max_completion_tokens: 2000,
            };

            if (useResponseFormat) {
                request.response_format = { type: 'json_object' };
            }

            // Some gpt-5 models only support the default temperature; omit it to avoid 400s on Vercel.
            if (!model.startsWith('gpt-5')) {
                request.temperature = 0.4;
            } else {
                // Reduce hidden reasoning tokens to avoid `finish_reason=length` with empty output.
                (request as any).reasoning_effort = 'low';
            }

            const response = await openai.chat.completions.create(request);

            if (!('choices' in response)) {
                throw new Error('Unexpected streaming response');
            }

            const choice = response.choices?.[0];
            const content = choice?.message?.content;
            if (content) return content;

            const finish = (choice as any)?.finish_reason ?? 'unknown';
            const refusal = (choice as any)?.message?.refusal;
            const requestId = (response as any)?._request_id;
            if (refusal) {
                throw new Error(`Refused: ${refusal}${requestId ? ` (request_id=${requestId})` : ''}`);
            }
            throw new Error(`No content (finish_reason=${finish}${requestId ? `, request_id=${requestId}` : ''})`);
        };

        // Primary: strict JSON mode
        let content = await createOnce(true);
        let report: AIReport;
        try {
            report = tryParseJsonReport(content);
        } catch {
            // Retry once without response_format, in case the model returns an empty content in JSON mode.
            content = await createOnce(false);
            report = tryParseJsonReport(content);
        }

        return { report, meta: { status: 'ok' } };
    } catch (error) {
        console.error('AI Generation Failed:', error);
        const report = getFallbackReport(locale);
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
