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

export interface ScoreResult {
    total: number;
    categories: ScoreCategory;
    details: {
        signals: string[];
        // Add more detailed breakdown if needed
    }
}
