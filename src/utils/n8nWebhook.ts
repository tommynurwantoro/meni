import axios, { AxiosError } from 'axios';

export interface N8NWebhookResponse {
    output: string;
}

export interface N8NWebhookError {
    message: string;
    statusCode?: number;
}

/**
 * Calls the n8n webhook with the provided message content
 * @param messageContent The message content to send to the AI agent
 * @param guildId The Discord guild ID
 * @param userId The Discord user ID who sent the message
 * @param referenceMessage Optional referenced message content for additional context
 * @returns Promise resolving to the AI output string
 * @throws N8NWebhookError if the request fails
 */
export async function callN8NWebhook(
    messageContent: string,
    guildId: string,
    userId: string,
    referenceMessage?: string
): Promise<string> {
    try {
        const payload: {
            message: string;
            guildId: string;
            userId: string;
            referenceMessage?: string;
        } = {
            message: messageContent,
            guildId,
            userId
        };

        // Include referenced message if provided
        if (referenceMessage) {
            payload.referenceMessage = referenceMessage;
        }

        const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || '';
        if (!n8nWebhookUrl) {
            throw new Error('N8N_WEBHOOK_URL environment variable is not set');
        }

        const n8nUsername = process.env.N8N_USERNAME || '';
        if (!n8nUsername) {
            throw new Error('N8N_USERNAME environment variable is not set');
        }

        const n8nPassword = process.env.N8N_PASSWORD || '';
        if (!n8nPassword) {
            throw new Error('N8N_PASSWORD environment variable is not set');
        }

        const response = await axios.post<N8NWebhookResponse>(
            n8nWebhookUrl,
            payload,
            {
                auth: {
                    username: n8nUsername,
                    password: n8nPassword
                },
                timeout: 30000, // 30 second timeout
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        // Extract the output field from the response
        if (response.data && typeof response.data.output === 'string') {
            return response.data.output;
        }

        // If response structure is different, try to handle it
        if (typeof response.data === 'string') {
            return response.data;
        }

        throw new Error('Invalid response format: missing output field');
    } catch (error) {
        if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError;
            const errorMessage: N8NWebhookError = {
                message: axiosError.message || 'Unknown error occurred',
                statusCode: axiosError.response?.status
            };

            // Provide more specific error messages
            if (axiosError.response?.status === 401) {
                errorMessage.message = 'Authentication failed with n8n webhook';
            } else if (axiosError.response?.status === 404) {
                errorMessage.message = 'n8n webhook endpoint not found';
            } else if (axiosError.response?.status === 500) {
                errorMessage.message = 'n8n webhook server error';
            } else if (axiosError.code === 'ECONNABORTED') {
                errorMessage.message = 'Request to n8n webhook timed out';
            } else if (axiosError.code === 'ENOTFOUND' || axiosError.code === 'ECONNREFUSED') {
                errorMessage.message = 'Could not connect to n8n webhook';
            }

            throw errorMessage;
        }

        // Handle non-axios errors
        throw {
            message: error instanceof Error ? error.message : 'Unknown error occurred'
        } as N8NWebhookError;
    }
}

