import { NextResponse } from 'next/server';
// import { createJob, updateJob } from '@/lib/jobQueue'; // Removed for streaming
import { crawlSite } from '@/lib/crawler';
import { calculateScore } from '@/lib/scoring';
import { generateAIReport } from '@/lib/ai';
import { classifySite } from '@/lib/siteClassification';

export const runtime = 'nodejs';

function applyUncertainPenalty(score: ReturnType<typeof calculateScore>) {
    const factor = 0.85;
    const categories = {
        relevance: Math.floor(score.categories.relevance * factor),
        structure: Math.floor(score.categories.structure * factor),
        indexing: Math.floor(score.categories.indexing * factor),
        trust: Math.floor(score.categories.trust * factor),
        faq_schema: Math.floor(score.categories.faq_schema * factor),
    };
    return {
        ...score,
        total: categories.relevance + categories.structure + categories.indexing + categories.trust + categories.faq_schema,
        categories,
    };
}

export async function POST(req: Request) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const sendEvent = (data: any) => {
                controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
            };

            try {
                const body = await req.json();
                const { url, hospitalName, address, keywords, locale } = body;

                sendEvent({ type: 'progress', value: 10, step: 'Crawling' });

                // 1. Crawl
                const pages = await crawlSite(url, 10);
                if (pages.length === 0) {
                    const msg =
                        (locale || 'ko') === 'ja'
                            ? 'ページを取得できませんでした。サイト側の制限(ボット対策)やJS描画により取得できない可能性があります。'
                            : '페이지를 가져오지 못했습니다. 사이트의 봇 차단 또는 JS 렌더링으로 인해 수집이 제한될 수 있습니다.';
                    throw new Error(msg);
                }
                sendEvent({ type: 'progress', value: 50, step: 'Scoring', pagesCount: pages.length });

                const siteClassification = classifySite(pages, locale || 'ko');

                // 2. Score
                let scoreResult = calculateScore(pages, {
                    hospitalName,
                    keywords: (keywords || '').split(','),
                    locale: locale || 'ko'
                });
                if (siteClassification.level === 'uncertain') {
                    scoreResult = applyUncertainPenalty(scoreResult);
                }
                sendEvent({ type: 'progress', value: 70, step: 'AI Analysis' });

                // 3. AI Report
                let aiReport: any = null;
                let aiMeta: any = { status: 'skipped', message: 'AI generation skipped' };
                if (siteClassification.level !== 'no') {
                    const result = await generateAIReport(
                        scoreResult,
                        pages,
                        hospitalName,
                        address,
                        (keywords || '').split(','),
                        locale || 'ko'
                    );
                    aiReport = result.report;
                    aiMeta = result.meta;
                }
                sendEvent({ type: 'progress', value: 90, step: 'Finalizing' });

                // Finish
                const finalResult = {
                    score: scoreResult,
                    ai: aiReport,
                    aiMeta,
                    pagesAnalyzed: pages.length,
                    siteClassification
                };

                sendEvent({ type: 'complete', result: finalResult });
                controller.close();

            } catch (err: any) {
                console.error("Stream Error", err);
                sendEvent({ type: 'error', message: err.message || 'Analysis failed' });
                controller.close();
            }
        }
    });

    return new NextResponse(stream, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
        }
    });
}
