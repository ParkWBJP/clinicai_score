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

export interface CrawlResult {
    pages: PageData[];
    totalScanned: number;
}

export interface ScoreCategory {
    relevance: number;
    structure: number;
    indexing: number;
    trust: number;
    faq_schema: number;
}

export interface ScoreCheckItem {
    key: string;
    ok: boolean;
    label: string;
}

export interface ScoreResult {
    total: number;
    categories: ScoreCategory;
    details: {
        signals: string[];
        metrics?: {
            pagesAnalyzed: number;
            validPages: number;
            validRatio: number;
            strongPages: number;
        };
        checks?: {
            relevance: ScoreCheckItem[];
            structure: ScoreCheckItem[];
            indexing: ScoreCheckItem[];
            trust: ScoreCheckItem[];
            faq_schema: ScoreCheckItem[];
        };
        caps?: {
            totalCap?: number;
            indexingCap?: number;
            trustCap?: number;
        };
    }
}
