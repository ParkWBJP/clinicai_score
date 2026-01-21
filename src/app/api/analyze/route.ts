import { NextResponse } from 'next/server';
import { createJob, updateJob } from '@/lib/jobQueue';
import { crawlSite } from '@/lib/crawler';
import { calculateScore } from '@/lib/scoring';
import { generateAIReport } from '@/lib/ai';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { url, hospitalName, address, keywords, locale } = body;

        const jobId = createJob();

        // Start background processing
        (async () => {
            try {
                updateJob(jobId, { status: 'processing', progress: 10 });

                // 1. Crawl
                const pages = await crawlSite(url, 10);
                updateJob(jobId, { progress: 50 });

                if (pages.length === 0) {
                    throw new Error("No pages found");
                }

                // 2. Score
                const scoreResult = calculateScore(pages, {
                    hospitalName,
                    keywords: (keywords || '').split(','),
                    locale: locale || 'ko'
                });
                updateJob(jobId, { progress: 70 });

                // 3. AI Report
                const aiReport = await generateAIReport(scoreResult, pages, hospitalName, address, (keywords || '').split(','), locale || 'ko');
                updateJob(jobId, { progress: 90 });

                // Finish
                const finalResult = {
                    score: scoreResult,
                    ai: aiReport,
                    pagesAnalyzed: pages.length
                };

                updateJob(jobId, { status: 'completed', progress: 100, result: finalResult });

            } catch (err: any) {
                console.error("Job Failed", err);
                updateJob(jobId, { status: 'failed', error: err.message, progress: 100 });
            }
        })();

        return NextResponse.json({ jobId });

    } catch (error) {
        return NextResponse.json({ error: 'Failed to start job' }, { status: 500 });
    }
}
