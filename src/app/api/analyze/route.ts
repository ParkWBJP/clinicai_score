import { NextResponse } from 'next/server';
// import { createJob, updateJob } from '@/lib/jobQueue'; // Removed for streaming
import { crawlSite } from '@/lib/crawler';
import { calculateScore } from '@/lib/scoring';
import { generateAIReport } from '@/lib/ai';

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
                    throw new Error("No pages found");
                }
                sendEvent({ type: 'progress', value: 50, step: 'Scoring', pagesCount: pages.length });

                // 2. Score
                const scoreResult = calculateScore(pages, {
                    hospitalName,
                    keywords: (keywords || '').split(','),
                    locale: locale || 'ko'
                });
                sendEvent({ type: 'progress', value: 70, step: 'AI Analysis' });

                // 3. AI Report
                const aiReport = await generateAIReport(scoreResult, pages, hospitalName, address, (keywords || '').split(','), locale || 'ko');
                sendEvent({ type: 'progress', value: 90, step: 'Finalizing' });

                // Finish
                const finalResult = {
                    score: scoreResult,
                    ai: aiReport,
                    pagesAnalyzed: pages.length
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
