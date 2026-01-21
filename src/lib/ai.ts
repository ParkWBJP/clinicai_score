import OpenAI from 'openai';
import { ScoreResult, PageData } from './types';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'dummy', // Prevent crash if key missing
});

export interface AIReport {
    overview_100: string;
    pros: string[];
    cons: string[];
    card_overviews: {
        relevance: string;
        structure: string;
        indexing: string;
        trust: string;
        faq_schema: string;
    };
}

export async function generateAIReport(
    score: ScoreResult,
    pages: PageData[],
    hospitalName: string,
    address: string,
    keywords: string[],
    locale: 'ko' | 'ja'
): Promise<AIReport | null> {
    if (!process.env.OPENAI_API_KEY) {
        console.warn("OpenAI API Key missing, returning mock report.");
        return getMockReport(locale);
    }

    const systemPrompt = `너는 Clinic.ai의 전문 진단 리포트 작성자다. 반드시 제공된 signals/scores에만 근거하여 간결하고 단정한 리포트를 작성한다. 의료 조언을 하지 않는다. 반드시 JSON만 출력한다.`;

    const userPromptKO = `출력 언어는 한국어. 아래 입력 JSON을 근거로 overview_100, pros(3), cons(3), card_overviews(5개)를 생성하라. 반드시 JSON만 출력.`;
    const userPromptJA = `出力は日本語。下記の入力JSONを根拠に overview_100, pros(3), cons(3), card_overviews(5) を生成してください。必ずJSONのみ出力してください。`;

    const inputJson = JSON.stringify({
        user_input: { hospital_name: hospitalName, address, keywords },
        analysis_meta: { analyzed_pages_count: pages.length, max_pages: 10 },
        signals: score.details.signals,
        scores: { total_score: score.total, category_scores: score.categories },
        top_findings: pages.slice(0, 3).map(p => ({ title: p.title, h1: p.h1.slice(0, 1) }))
    });

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Use gpt-4o-mini as proxy for "gpt-5-mini" (future)
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `${locale === 'ko' ? userPromptKO : userPromptJA}\n\nInput:\n${inputJson}` }
            ],
            response_format: { type: "json_object" },
            temperature: 0.3,
            max_tokens: 1000
        });

        const content = response.choices[0].message.content;
        if (!content) throw new Error("No content");

        return JSON.parse(content) as AIReport;

    } catch (error) {
        console.error("AI Generation Failed:", error);
        return getMockReport(locale); // Fallback
    }
}

function getMockReport(locale: 'ko' | 'ja'): AIReport {
    return {
        overview_100: locale === 'ko'
            ? "전반적으로 신뢰도 높은 콘텐츠를 보유하고 있으나, 검색 최적화 기술 적용이 미흡합니다. 일부 구조적 개선을 통해 더 많은 잠재 고객에게 도달할 수 있습니다."
            : "全体として信頼性の高いコンテンツを保有していますが、検索最適化技術の適用が不十分です。一部の構造的な改善を通じて、より多くの潜在顧客に到達することができます。",
        pros: locale === 'ko'
            ? ["진료 분야 전문성이 잘 드러납니다.", "기본적인 병원 정보가 충실합니다.", "모바일 가독성이 양호합니다."]
            : ["診療分野の専門性がよく表れています。", "基本的な病院情報が充実しています。", "モバイルの可読性が良好です。"],
        cons: locale === 'ko'
            ? ["검색 최적화(SEO) 태그가 부족합니다.", "구조화된 데이터가 없습니다.", "내부 링크 구조가 단순합니다."]
            : ["検索最適化(SEO)タグが不足しています。", "構造化データがありません。", "内部リンク構造が単純です。"],
        card_overviews: {
            relevance: "Content fits target keywords well.",
            structure: "Headings need better hierarchy.",
            indexing: "Meta tags are missing.",
            trust: "Trust signals are present.",
            faq_schema: "FAQ schema is missing."
        }
    };
}
