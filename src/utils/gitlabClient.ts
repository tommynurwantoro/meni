import axios, { AxiosInstance } from 'axios';

interface GitLabTag {
    name: string;
    message: string;
    target: string;
    commit: {
        id: string;
        short_id: string;
        created_at: string;
        title: string;
        message: string;
        author_name: string;
        committed_date: string;
    };
    release: null | {
        tag_name: string;
        description: string;
    };
    protected: boolean;
}

interface GitLabClientConfig {
    baseUrl: string;
    token: string;
}

export class GitLabClient {
    private client: AxiosInstance;
    private baseUrl: string;

    constructor(config: GitLabClientConfig) {
        this.baseUrl = config.baseUrl;
        this.client = axios.create({
            baseURL: config.baseUrl,
            headers: {
                'PRIVATE-TOKEN': config.token,
                'Content-Type': 'application/json',
            },
            timeout: 30000,
        });
    }

    /**
     * Get tags for a GitLab project
     */
    async getProjectTags(projectId: string, limit: number = 5): Promise<GitLabTag[]> {
        try {
            console.log(`🔍 Fetching tags for GitLab project ${projectId}...`);
            
            const response = await this.client.get(`/api/v4/projects/${projectId}/repository/tags`, {
                params: {
                    per_page: limit,
                    order_by: 'updated',
                    sort: 'desc',
                }
            });

            console.log(`✅ Found ${response.data.length} tag(s) for project ${projectId}`);
            return response.data;
        } catch (error: any) {
            console.error(`❌ Failed to fetch tags for project ${projectId}:`, error.response?.data?.message || error.message);
            throw new Error(`Failed to fetch GitLab tags: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Get a specific tag details
     */
    async getTag(projectId: string, tagName: string): Promise<GitLabTag> {
        try {
            const response = await this.client.get(`/api/v4/projects/${projectId}/repository/tags/${tagName}`);
            return response.data;
        } catch (error: any) {
            throw new Error(`Failed to fetch tag ${tagName}: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Get project details
     */
    async getProject(projectId: string): Promise<any> {
        try {
            const response = await this.client.get(`/api/v4/projects/${projectId}`);
            return response.data;
        } catch (error: any) {
            throw new Error(`Failed to fetch project details: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Create a new tag
     */
    async createTag(projectId: string, tagName: string, ref: string, message: string): Promise<GitLabTag> {
        try {
            const response = await this.client.post(`/api/v4/projects/${projectId}/repository/tags`, {
                tag_name: tagName,
                ref: ref,
                message: message
            });
            return response.data;
        } catch (error: any) {
            throw new Error(`Failed to create tag ${tagName}: ${error.response?.data?.message || error.message}`);
        }
    }
}

// Singleton instance
let gitlabClientInstance: GitLabClient | null = null;

export function initializeGitLabClient(baseUrl: string, token: string): GitLabClient {
    gitlabClientInstance = new GitLabClient({ baseUrl, token });
    return gitlabClientInstance;
}
