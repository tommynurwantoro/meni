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

    /**
     * Get file content from a GitLab repository
     */
    async getFile(projectId: string, filePath: string, branch: string = 'main'): Promise<string> {
        try {
            console.log(`🔍 Fetching file ${filePath} from GitLab project ${projectId} (branch: ${branch})...`);
            
            const response = await this.client.get(`/api/v4/projects/${projectId}/repository/files/${encodeURIComponent(filePath)}/raw`, {
                params: {
                    ref: branch
                }
            });

            console.log(`✅ Successfully fetched file ${filePath} from project ${projectId}`);
            return response.data;
        } catch (error: any) {
            console.error(`❌ Failed to fetch file ${filePath} from project ${projectId}:`, error.response?.data?.message || error.message);
            throw new Error(`Failed to fetch GitLab file: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Update file content in a GitLab repository
     */
    async updateFile(projectId: string, filePath: string, branch: string, content: string, commitMessage: string): Promise<{ commit_id: string; branch: string; file_path: string }> {
        try {
            console.log(`📝 Updating file ${filePath} in GitLab project ${projectId} (branch: ${branch})...`);
            console.log(`🔍 Content length: ${content.length} characters`);
            console.log(`📋 Commit message: ${commitMessage}`);
            
            // Validate content is not empty
            if (!content || content.trim().length === 0) {
                throw new Error('File content cannot be empty');
            }
            
            // Validate commit message
            if (!commitMessage || commitMessage.trim().length === 0) {
                throw new Error('Commit message cannot be empty');
            }
            
            // First check if file exists to determine if we should create or update
            let fileExists = false;
            try {
                await this.getFile(projectId, filePath, branch);
                fileExists = true;
                console.log(`📄 File ${filePath} exists, will update`);
            } catch (error: any) {
                if (error.message.includes('Failed to fetch GitLab file')) {
                    console.log(`📄 File ${filePath} does not exist, will create`);
                    fileExists = false;
                } else {
                    throw error; // Re-throw other errors
                }
            }
            
            // Log the full request for debugging
            const requestData = {
                branch: branch,
                content: content,
                commit_message: commitMessage
            };
            
            console.log(`🔧 Request data keys: ${Object.keys(requestData).join(', ')}`);
            console.log(`❝ Project ID: ${projectId}`);
            console.log(`❝ File path: ${encodeURIComponent(filePath)}`);
            
            let response;
            if (fileExists) {
                // Update existing file
                response = await this.client.put(`/api/v4/projects/${projectId}/repository/files/${encodeURIComponent(filePath)}`, requestData);
            } else {
                // Create new file
                response = await this.client.post(`/api/v4/projects/${projectId}/repository/files/${encodeURIComponent(filePath)}`, requestData);
            }

            console.log(`✅ Successfully ${fileExists ? 'updated' : 'created'} file ${filePath} in project ${projectId}`);
            return response.data;
        } catch (error: any) {
            const errorDetails = error.response?.data || {};
            console.error(`❌ Failed to ${error.response?.status === 404 ? 'create' : 'update'} file ${filePath} in project ${projectId}:`, {
                status: error.response?.status,
                statusText: error.response?.statusText,
                message: error.response?.data?.message || error.message,
                error: errorDetails
            });
            
            // Provide more specific error messages
            let errorMessage = `Failed to update GitLab file: ${error.response?.data?.message || error.message}`;
            
            // Common GitLab API errors
            if (error.response?.status === 400) {
                if (errorDetails.message?.includes('content is too large')) {
                    errorMessage = 'File content is too large for GitLab API';
                } else if (errorDetails.message?.includes('branch not found')) {
                    errorMessage = `Branch '${branch}' does not exist in project ${projectId}`;
                } else if (errorDetails.message?.includes('file not found')) {
                    errorMessage = `File '${filePath}' does not exist in branch '${branch}'`;
                } else if (errorDetails.message?.includes('invalid encoding')) {
                    errorMessage = 'Invalid file encoding. Check if file content is valid text';
                } else if (errorDetails.message?.includes('Content parameter')) {
                    errorMessage = 'Invalid file content format. Check for special characters or encoding issues';
                }
            } else if (error.response?.status === 404) {
                errorMessage = `GitLab repository or file not found. Check permissions and project ID ${projectId}`;
            } else if (error.response?.status === 401 || error.response?.status === 403) {
                errorMessage = 'Access denied. Check GitLab token permissions (needs api scope)';
            }
            
            throw new Error(errorMessage);
        }
    }
}

// Singleton instance
let gitlabClientInstance: GitLabClient | null = null;

export function initializeGitLabClient(baseUrl: string, token: string): GitLabClient {
    gitlabClientInstance = new GitLabClient({ baseUrl, token });
    return gitlabClientInstance;
}
