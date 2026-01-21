import * as cheerio from 'cheerio';

export interface PageData {
    url: string;
    title: string;
    description: string;
    h1: string[];
    h2: string[];
    bodyText: string;
    hasCanonical: boolean;
    hasViewport: boolean;
    hasOgTags: boolean;
    hasSchema: boolean;
    schemaTypes: string[];
    internalLinks: string[];
    faqCount: number;
}

// Simple in-memory fetch with timeout
async function fetchHtml(url: string): Promise<string | null> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout per page

        const res = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'ClinicAI-Bot/1.0'
            }
        });

        clearTimeout(timeoutId);

        if (!res.ok) return null;
        return await res.text();
    } catch (error) {
        console.error(`Failed to fetch ${url}`, error);
        return null;
    }
}

export async function crawlSite(baseUrl: string, maxPages: number = 10): Promise<PageData[]> {
    const visited = new Set<string>();
    const queue: string[] = [baseUrl];
    const results: PageData[] = [];

    // Normalize URL helper
    const normalize = (u: string) => {
        try {
            const parsed = new URL(u);
            return parsed.origin + parsed.pathname; // Ignore query params/hash for dedupe
        } catch {
            return u;
        }
    };

    while (queue.length > 0 && results.length < maxPages) {
        const currentUrl = queue.shift()!;
        const normalizedUrl = normalize(currentUrl);

        if (visited.has(normalizedUrl)) continue;
        visited.add(normalizedUrl);

        const html = await fetchHtml(currentUrl);
        if (!html) continue;

        const $ = cheerio.load(html);

        // Extract Data
        const title = $('title').text().trim();
        const description = $('meta[name="description"]').attr('content') || '';
        const h1 = $('h1').map((_, el) => $(el).text().trim()).get();
        const h2 = $('h2').map((_, el) => $(el).text().trim()).get();
        const bodyText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 5000); // Limit text

        const hasCanonical = !!$('link[rel="canonical"]').attr('href');
        const hasViewport = !!$('meta[name="viewport"]').attr('content');
        const hasOgTags = $('meta[property^="og:"]').length >= 2;

        // Schema
        const scriptTags = $('script[type="application/ld+json"]');
        const schemaTypes: string[] = [];
        scriptTags.each((_, el) => {
            try {
                const json = JSON.parse($(el).text());
                if (json['@type']) {
                    schemaTypes.push(json['@type']);
                } else if (Array.isArray(json)) { // Graph
                    json.forEach(item => { if (item['@type']) schemaTypes.push(item['@type']); });
                } else if (json['@graph']) {
                    json['@graph'].forEach((item: any) => { if (item['@type']) schemaTypes.push(item['@type']); });
                }
            } catch (e) { /* ignore parse error */ }
        });
        const hasSchema = schemaTypes.length > 0;

        // FAQ Estimation (Simple heuristic for Q/A pattern)
        // Looking for dl/dt/dd or accordion classes or specific text patterns?
        // Let's count "Q." or "?" in strong/h tags for high recall
        const faqCount = $('dt, .faq-question, .question').length || (bodyText.match(/Q\.|Question|질문/g) || []).length;

        // Internal Links
        const links: string[] = [];
        $('a[href]').each((_, el) => {
            const href = $(el).attr('href');
            if (href) {
                try {
                    const absolute = new URL(href, currentUrl).href;
                    if (absolute.startsWith(new URL(baseUrl).origin)) {
                        links.push(absolute);
                    }
                } catch { /* invalid url */ }
            }
        });

        results.push({
            url: currentUrl,
            title,
            description,
            h1,
            h2,
            bodyText,
            hasCanonical,
            hasViewport,
            hasOgTags,
            hasSchema,
            schemaTypes,
            internalLinks: links,
            faqCount
        });

        // Enqueue valid internal links
        for (const link of links) {
            if (!visited.has(normalize(link)) && !queue.includes(link)) {
                queue.push(link);
            }
        }
    }

    return results;
}
