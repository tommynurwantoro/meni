/**
 * GitOps utility functions for YAML content manipulation
 */

/**
 * Update image tag in a YAML configuration for a specific service
 * 
 * @param yamlContent - The YAML content as a string
 * @param serviceName - The name of the service to update in the YAML
 * @param newTag - The new image tag to set
 * @returns Updated YAML content
 */
export function updateImageTagInYaml(yamlContent: string, serviceName: string, newTag: string): string {
    // Split YAML content into lines for processing
    const lines = yamlContent.split('\n');
    let inServiceBlock = false;
    let currentService = '';
    let updatedLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        
        // Check if we're entering a service block
        if (trimmedLine.match(/^\s*[a-zA-Z0-9_-]+:\s*$/)) {
            if (inServiceBlock && currentService === serviceName) {
                // We were in the target service but now leaving it
                inServiceBlock = false;
                currentService = '';
            }
            
            // Extract service name from line like "  service-name:"
            const serviceMatch = trimmedLine.match(/^(\s*)([a-zA-Z0-9_-]+):\s*$/);
            if (serviceMatch) {
                currentService = serviceMatch[2];
                inServiceBlock = currentService === serviceName;
            }
        }
        
        // If we're in the target service block and find an image line, update it
        if (inServiceBlock && trimmedLine.match(/^image:\s*.+/)) {
            // Match the original line with full preservation of indentation
            const imageMatch = line.match(/^(\s*)(image:\s*)(.+?):(\S+)(\s*)$/);
            if (imageMatch) {
                const leadingWhitespace = imageMatch[1];
                const imagePrefix = imageMatch[2];
                const registryAndImage = imageMatch[3];
                const tag = imageMatch[4];
                const trailingWhitespace = imageMatch[5];
                
                // Reconstruct the line preserving exact original indentation
                const updatedLine = `${leadingWhitespace}${imagePrefix}${registryAndImage}:${newTag}${trailingWhitespace}`;
                updatedLines.push(updatedLine);
                
                console.log(`📝 Updated ${serviceName} image tag from ${tag} to ${newTag}`);
                continue;
            }
        }
        
        updatedLines.push(line);
    }
    
    return updatedLines.join('\n');
}

/**
 * Extract the current image tag for a specific service from YAML content
 * 
 * @param yamlContent - The YAML content as a string  
 * @param serviceName - The name of the service to check
 * @returns The current image tag or null if not found
 */
export function extractCurrentImageTag(yamlContent: string, serviceName: string): string | null {
    const lines = yamlContent.split('\n');
    let inServiceBlock = false;
    let currentService = '';
    
    for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Check if we're entering a service block
        const serviceMatch = trimmedLine.match(/^(\s*)([a-zA-Z0-9_-]+):\s*$/);
        if (serviceMatch) {
            if (inServiceBlock && currentService === serviceName) {
                // We were in the target service but now leaving it
                inServiceBlock = false;
                currentService = '';
            }
            
            currentService = serviceMatch[2];
            inServiceBlock = currentService === serviceName;
        }
        
        // If we're in the target service block and find an image line, extract the tag
        if (inServiceBlock && trimmedLine.match(/^image:\s*.+/)) {
            const imageMatch = trimmedLine.match(/^image:\s*.+?:(\S+)/);
            if (imageMatch) {
                return imageMatch[1];
            }
        }
    }
    
    return null;
}

/**
 * Validate that the service exists in the YAML content
 * 
 * @param yamlContent - The YAML content as a string
 * @param serviceName - The name of the service to validate
 * @returns True if service is found, false otherwise
 */
export function validateServiceExists(yamlContent: string, serviceName: string): boolean {
    const servicePattern = new RegExp(`^\\s*${serviceName}:\\s*$`, 'm');
    return servicePattern.test(yamlContent);
}

/**
 * Generate a commit message for GitOps updates
 * 
 * @param serviceName - The name of the service being updated
 * @param oldTag - The old image tag (optional)
 * @param newTag - The new image tag
 * @returns Formatted commit message
 */
export function generateCommitMessage(serviceName: string, newTag: string, oldTag?: string): string {
    if (oldTag) {
        return `Update ${serviceName} image tag from ${oldTag} to ${newTag}`;
    } else {
        return `Update ${serviceName} image tag to ${newTag}`;
    }
}

/**
 * Validate YAML content before uploading to GitLab
 * 
 * @param yamlContent - The YAML content to validate
 * @returns True if content is valid
 * @throws Error if content is invalid
 */
export function validateYamlContent(yamlContent: string): string {
    if (!yamlContent || yamlContent.trim().length === 0) {
        throw new Error('YAML content cannot be empty');
    }
    
    let cleanedContent = yamlContent;
    
    // Check for common YAML syntax patterns that might cause GitLab API issues
    const invalidPatterns = [
        /^---\s*$\n\s*\n/m, // Empty document separator
        /^\s*[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/m, // Control characters
        /\t/m, // Tabs (YAML doesn't like tabs)
    ];
    
    for (const pattern of invalidPatterns) {
        if (pattern.test(cleanedContent)) {
            if (pattern === invalidPatterns[1]) {
                // Replace tabs with spaces for YAML compliance
                cleanedContent = cleanedContent.replace(/\t/g, '  ');
                console.warn('⚠️ YAML content contained tabs, converted to spaces for GitLab compatibility');
            } else {
                throw new Error('YAML content contains invalid characters or formatting');
            }
        }
    }
    
    // Remove trailing whitespace on lines
    cleanedContent = cleanedContent.replace(/[ \t]+$/gm, '');
    
    // Ensure file ends with single newline
    if (cleanedContent && !cleanedContent.endsWith('\n')) {
        cleanedContent += '\n';
    }
    
    // Remove excessive blank lines (more than 2 consecutive)
    cleanedContent = cleanedContent.replace(/\n\n\n+/g, '\n\n');
    
    console.log(`✅ YAML content validated and cleaned (${cleanedContent.length} characters)`);
    return cleanedContent;
}
