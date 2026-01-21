export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface AnalysisJob {
    id: string;
    status: JobStatus;
    progress: number;
    result?: any;
    error?: string;
    createdAt: number;
}

// Global store to persist during dev server HMR
const globalForJobs = global as unknown as { jobStore: Map<string, AnalysisJob> };

export const jobStore = globalForJobs.jobStore || new Map<string, AnalysisJob>();

if (process.env.NODE_ENV !== 'production') globalForJobs.jobStore = jobStore;

export function createJob(): string {
    const id = Math.random().toString(36).substring(2, 15);
    jobStore.set(id, {
        id,
        status: 'pending',
        progress: 0,
        createdAt: Date.now()
    });
    return id;
}

export function updateJob(id: string, updates: Partial<AnalysisJob>) {
    const job = jobStore.get(id);
    if (job) {
        jobStore.set(id, { ...job, ...updates });
    }
}

export function getJob(id: string) {
    return jobStore.get(id);
}
