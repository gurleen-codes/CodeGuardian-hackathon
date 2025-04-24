// CodeGuardian - GitHub Repository Scanner
// This component scans GitHub repositories for similar code patterns and their associated issues

const { Octokit } = require('@octokit/rest');
const { throttling } = require('@octokit/plugin-throttling');
const { retry } = require('@octokit/plugin-retry');
const { OpenAIClient, AzureKeyCredential } = require("@azure/openai");
const { CosmosClient } = require('@azure/cosmos');

// Extend Octokit with plugins
const OctokitWithPlugins = Octokit.plugin(throttling, retry);

class GitHubRepositoryScanner {
  constructor(config) {
    this.githubToken = config.githubToken;
    this.openaiEndpoint = config.openaiEndpoint;
    this.openaiKey = config.openaiKey;
    this.openaiDeployment = config.openaiDeployment;
    this.cosmosEndpoint = config.cosmosEndpoint;
    this.cosmosKey = config.cosmosKey;
    this.cosmosDatabase = config.cosmosDatabase || 'codeguardian';
    this.cosmosContainer = config.cosmosContainer || 'pattern-library';
    
    // Initialize GitHub client with rate limiting
    this.octokit = new OctokitWithPlugins({
      auth: this.githubToken,
      throttle: {
        onRateLimit: (retryAfter, options, octokit, retryCount) => {
          octokit.log.warn(`Request quota exhausted for request ${options.method} ${options.url}`);
          if (retryCount < 2) {
            octokit.log.info(`Retrying after ${retryAfter} seconds!`);
            return true;
          }
          return false;
        },
        onSecondaryRateLimit: (retryAfter, options, octokit) => {
          octokit.log.warn(`Secondary rate limit hit for ${options.method} ${options.url}`);
          return true;
        },
      },
    });
    
    // Initialize OpenAI client
    this.openaiClient = new OpenAIClient(
      this.openaiEndpoint,
      new AzureKeyCredential(this.openaiKey)
    );
    
    // Initialize Cosmos DB client
    this.cosmosClient = new CosmosClient({
      endpoint: this.cosmosEndpoint,
      key: this.cosmosKey
    });
    
    // Initialize the database and container
    this.initializeCosmosDB();
  }
  
  /**
   * Initialize Cosmos DB database and container
   */
  async initializeCosmosDB() {
    try {
      const { database } = await this.cosmosClient.databases.createIfNotExists({ 
        id: this.cosmosDatabase 
      });
      
      const { container } = await database.containers.createIfNotExists({ 
        id: this.cosmosContainer,
        partitionKey: { paths: ["/language"] }
      });
      
      this.container = container;
      console.log('Cosmos DB initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Cosmos DB:', error);
      throw error;
    }
  }
  
  /**
   * Find similar code patterns for the given code snippet
   * @param {Object} codeInfo - Information about the code snippet
   * @param {string} codeInfo.language - Programming language
   * @param {string} codeInfo.code - The code snippet
   * @param {string} codeInfo.filename - Filename (optional)
   * @returns {Promise<Array>} Similar patterns found
   */
  async findSimilarPatterns(codeInfo) {
    const { language, code, filename } = codeInfo;
    
    try {
      // First, check our pattern library in Cosmos DB
      const localPatterns = await this.findPatternsInDatabase(language, code);
      
      // If we have enough matches locally, return them
      if (localPatterns.length >= 3) {
        return localPatterns;
      }
      
      // Otherwise, search GitHub for similar code
      const githubPatterns = await this.searchGitHubForSimilarCode(language, code);
      
      // Combine results, removing duplicates
      const allPatterns = [...localPatterns];
      for (const pattern of githubPatterns) {
        if (!allPatterns.some(p => p.patternId === pattern.patternId)) {
          allPatterns.push(pattern);
        }
      }
      
      // Store new patterns in our database for future reference
      await this.storeNewPatterns(githubPatterns);
      
      return allPatterns;
    } catch (error) {
      console.error('Error finding similar patterns:', error);
      return [];
    }
  }
  
  /**
   * Find code patterns in our Cosmos DB database
   */
  async findPatternsInDatabase(language, code) {
    try {
      // Extract key features of the code
      const codeFeatures = await this.extractCodeFeatures(code, language);
      
      // Query the database for patterns with similar features
      const querySpec = {
        query: "SELECT * FROM c WHERE c.language = @language AND ARRAY_CONTAINS(@features, c.primaryFeature)",
        parameters: [
          {
            name: "@language",
            value: language
          },
          {
            name: "@features",
            value: codeFeatures.primaryFeatures
          }
        ]
      };
      
      const { resources: patterns } = await this.container.items.query(querySpec).fetchAll();
      
      // For each pattern, calculate similarity score
      const scoredPatterns = await Promise.all(patterns.map(async pattern => {
        const similarityScore = await this.calculateSimilarity(code, pattern.codeSnippet);
        return {
          ...pattern,
          similarityScore
        };
      }));
      
      // Sort by similarity score and return top matches
      return scoredPatterns
        .filter(pattern => pattern.similarityScore > 0.7) // Only return reasonably similar patterns
        .sort((a, b) => b.similarityScore - a.similarityScore)
        .slice(0, 5);  // Return top 5 matches
    } catch (error) {
      console.error('Error finding patterns in database:', error);
      return [];
    }
  }
  
  /**
   * Search GitHub for similar code patterns
   */
  async searchGitHubForSimilarCode(language, code) {
    try {
      // Extract key features from the code
      const codeFeatures = await this.extractCodeFeatures(code, language);
      
      // Map language to GitHub search qualifier
      const languageQualifier = this.mapLanguageToGitHubQualifier(language);
      
      // Create search queries based on code features
      const searchQueries = codeFeatures.primaryFeatures.map(feature => 
        `${feature} language:${languageQualifier}`
      );
      
      // Execute searches and collect results
      const searchResults = [];
      for (const query of searchQueries.slice(0, 3)) { // Limit to top 3 features to avoid rate limiting
        const results = await this.searchCodeOnGitHub(query);
        searchResults.push(...results);
      }
      
      // Deduplicate results
      const uniqueResults = this.deduplicateResults(searchResults);
      
      // Get full code content for top matches
      const enrichedResults = await this.getFullCodeContent(uniqueResults.slice(0, 10));
      
      // Calculate similarity scores and filter to most relevant
      const scoredResults = await Promise.all(enrichedResults.map(async result => {
        const similarityScore = await this.calculateSimilarity(code, result.codeContent);
        return {
          ...result,
          similarityScore
        };
      }));
      
      // Convert to pattern format
      return scoredResults
        .filter(result => result.similarityScore > 0.6)
        .sort((a, b) => b.similarityScore - a.similarityScore)
        .slice(0, 5)
        .map(result => this.convertToPatternFormat(result, language, codeFeatures));
    } catch (error) {
      console.error('Error searching GitHub for similar code:', error);
      return [];
    }
  }
  
  /**
   * Search code on GitHub
   */
  async searchCodeOnGitHub(query) {
    try {
      const { data } = await this.octokit.search.code({
        q: query,
        per_page: 10,
        sort: 'indexed',
        order: 'desc'
      });
      
      return data.items.map(item => ({
        repository: item.repository.full_name,
        path: item.path,
        url: item.html_url,
        apiUrl: item.url
      }));
    } catch (error) {
      console.error(`Error searching GitHub with query "${query}":`, error);
      return [];
    }
  }
  
  /**
   * Get full code content for search results
   */
  async getFullCodeContent(results) {
    const enrichedResults = [];
    
    for (const result of results) {
      try {
        // Extract owner and repo from full name
        const [owner, repo] = result.repository.split('/');
        const path = result.path;
        
        // Get the file content
        const { data } = await this.octokit.repos.getContent({
          owner,
          repo,
          path
        });
        
        // Decode content if it's base64 encoded
        let codeContent;
        if (data.encoding === 'base64') {
          codeContent = Buffer.from(data.content, 'base64').toString('utf8');
        } else {
          codeContent = data.content;
        }
        
        // Find related issues in this repository
        const relatedIssues = await this.findRelatedIssues(owner, repo, path);
        
        enrichedResults.push({
          ...result,
          codeContent,
          relatedIssues
        });
      } catch (error) {
        console.error(`Error getting content for ${result.url}:`, error);
        // Skip this result if we can't get the content
      }
    }
    
    return enrichedResults;
  }
  
  /**
   * Find issues related to a file in a repository
   */
  async findRelatedIssues(owner, repo, path) {
    try {
      // Search for issues that mention this file
      const { data } = await this.octokit.search.issuesAndPullRequests({
        q: `repo:${owner}/${repo} ${path} in:body type:issue state:all`,
        per_page: 5,
        sort: 'updated',
        order: 'desc'
      });
      
      return data.items.map(issue => ({
        title: issue.title,
        url: issue.html_url,
        state: issue.state,
        createdAt: issue.created_at,
        closedAt: issue.closed_at,
        labels: issue.labels.map(label => label.name)
      }));
    } catch (error) {
      console.error(`Error finding related issues for ${owner}/${repo}/${path}:`, error);
      return [];
    }
  }
  
  /**
   * Store new patterns in the database
   */
  async storeNewPatterns(patterns) {
    try {
      // Store each pattern
      for (const pattern of patterns) {
        // Check if the pattern already exists
        const querySpec = {
          query: "SELECT * FROM c WHERE c.patternId = @patternId",
          parameters: [
            {
              name: "@patternId",
              value: pattern.patternId
            }
          ]
        };
        
        const { resources } = await this.container.items.query(querySpec).fetchAll();
        
        // If the pattern doesn't exist, create it
        if (resources.length === 0) {
          await this.container.items.create(pattern);
        }
      }
    } catch (error) {
      console.error('Error storing new patterns:', error);
    }
  }
  
  /**
   * Extract key features from code
   */
  async extractCodeFeatures(code, language) {
    try {
      // Use OpenAI to extract key features
      const result = await this.openaiClient.getChatCompletions(
        this.openaiDeployment,
        [
          { 
            role: "system", 
            content: "You are a code analysis expert that can identify key features and patterns in code." 
          },
          { 
            role: "user", 
            content: `
              Extract key features from this ${language} code:
              
              \`\`\`${language}
              ${code}
              \`\`\`
              
              Identify:
              1. Primary code patterns or algorithms used
              2. Key functions or methods
              3. Libraries or frameworks used
              4. Design patterns if applicable
              5. The main purpose of this code
              
              Respond in JSON format with:
              - primaryFeatures: Array of 3-5 key identifiable features (specific method names, patterns, etc.)
              - secondaryFeatures: Array of additional features
              - codeType: What type of code this is (e.g., API endpoint, data processing, UI component)
              - complexity: Estimated complexity (low, medium, high)
              
              Respond only with valid JSON.
            `
          }
        ],
        {
          temperature: 0.3,
          max_tokens: 1000,
          response_format: { type: "json_object" }
        }
      );
      
      // Parse the response
      try {
        return JSON.parse(result.choices[0].message.content);
      } catch (e) {
        console.warn(`Failed to parse OpenAI response as JSON: ${result.choices[0].message.content}`);
        return {
          primaryFeatures: this.extractFallbackFeatures(code),
          secondaryFeatures: [],
          codeType: "unknown",
          complexity: "medium"
        };
      }
    } catch (error) {
      console.error('Error extracting code features:', error);
      return {
        primaryFeatures: this.extractFallbackFeatures(code),
        secondaryFeatures: [],
        codeType: "unknown",
        complexity: "medium"
      };
    }
  }
  
  /**
   * Extract fallback features if AI-based extraction fails
   */
  extractFallbackFeatures(code) {
    // Simple regex-based feature extraction
    const features = [];
    
    // Extract function/method names
    const functionMatches = code.match(/function\s+(\w+)/g) || [];
    functionMatches.forEach(match => {
      const name = match.replace('function ', '').trim();
      if (name && name.length > 3) {
        features.push(name);
      }
    });
    
    // Extract class names
    const classMatches = code.match(/class\s+(\w+)/g) || [];
    classMatches.forEach(match => {
      const name = match.replace('class ', '').trim();
      if (name && name.length > 3) {
        features.push(name);
      }
    });
    
    // Extract import statements
    const importMatches = code.match(/import\s+.*?from\s+['"](.+?)['"];?/g) || [];
    importMatches.forEach(match => {
      const importStatement = match.trim();
      if (importStatement && importStatement.length > 10) {
        features.push(importStatement.substring(0, 50));
      }
    });
    
    return features.slice(0, 5);
  }
  
  /**
   * Calculate similarity between two code snippets
   */
  async calculateSimilarity(codeA, codeB) {
    try {
      // Use OpenAI to calculate similarity
      const result = await this.openaiClient.getChatCompletions(
        this.openaiDeployment,
        [
          { 
            role: "system", 
            content: "You are an expert at determining code similarity. Provide numerical similarity scores." 
          },
          { 
            role: "user", 
            content: `
              Compare these two code snippets and calculate their similarity:
              
              CODE SNIPPET A:
              \`\`\`
              ${codeA.substring(0, 2000)} // Truncate to avoid token limits
              \`\`\`
              
              CODE SNIPPET B:
              \`\`\`
              ${codeB.substring(0, 2000)} // Truncate to avoid token limits
              \`\`\`
              
              Respond only with a JSON object with:
              - similarityScore: A number between 0 and 1 representing similarity (1 being identical)
              - reason: A brief explanation of why you gave this score
              
              Respond only with valid JSON.
            `
          }
        ],
        {
          temperature: 0.2,
          max_tokens: 500,
          response_format: { type: "json_object" }
        }
      );
      
      // Parse the response
      try {
        const response = JSON.parse(result.choices[0].message.content);
        return response.similarityScore;
      } catch (e) {
        console.warn(`Failed to parse similarity score response: ${result.choices[0].message.content}`);
        // Use fallback similarity calculation
        return this.calculateFallbackSimilarity(codeA, codeB);
      }
    } catch (error) {
      console.error('Error calculating similarity:', error);
      return this.calculateFallbackSimilarity(codeA, codeB);
    }
  }
  
  /**
   * Fallback method to calculate similarity
   */
  calculateFallbackSimilarity(codeA, codeB) {
    // Very basic similarity - compare normalized tokens
    const tokensA = this.tokenize(codeA);
    const tokensB = this.tokenize(codeB);
    
    // Calculate Jaccard similarity
    const intersection = new Set([...tokensA].filter(x => tokensB.has(x)));
    const union = new Set([...tokensA, ...tokensB]);
    
    return intersection.size / union.size;
  }
  
  /**
   * Convert code to tokens for comparison
   */
  tokenize(code) {
    // Remove comments, whitespace, and split into tokens
    const normalized = code
      .replace(/\/\/.*$/gm, '') // Remove single line comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
      .replace(/\s+/g, ' ') // Normalize whitespace
      .toLowerCase(); // Case-insensitive
    
    // Split by common delimiters and filter empty tokens
    const tokens = normalized
      .split(/[\s\(\)\{\}\[\];,.<>:=+\-*/%!&|^~?]+/)
      .filter(token => token.length > 1);
    
    return new Set(tokens);
  }
  
  /**
   * Convert GitHub search result to our pattern format
   */
  convertToPatternFormat(result, language, codeFeatures) {
    // Generate a unique ID
    const patternId = `${language}-${Buffer.from(result.url).toString('base64').substring(0, 16)}`;
    
    return {
      patternId,
      language,
      sourceRepository: result.repository,
      sourcePath: result.path,
      sourceUrl: result.url,
      codeSnippet: result.codeContent,
      primaryFeature: codeFeatures.primaryFeatures[0] || 'unknown',
      allFeatures: codeFeatures.primaryFeatures,
      codeType: codeFeatures.codeType || 'unknown',
      complexity: codeFeatures.complexity || 'medium',
      relatedIssues: result.relatedIssues || [],
      similarityScore: result.similarityScore,
      dateAdded: new Date().toISOString()
    };
  }
  
  /**
   * Map language to GitHub search qualifier
   */
  mapLanguageToGitHubQualifier(language) {
    const mapping = {
      'JavaScript': 'javascript',
      'TypeScript': 'typescript',
      'Python': 'python',
      'Java': 'java',
      'C#': 'csharp',
      'C++': 'cpp',
      'Go': 'go',
      'Ruby': 'ruby',
      'PHP': 'php',
      'Swift': 'swift',
      'Kotlin': 'kotlin',
      'Rust': 'rust',
      // Add more as needed
    };
    
    return mapping[language] || language.toLowerCase();
  }
  
  /**
   * Remove duplicate search results
   */
  deduplicateResults(results) {
    const seen = new Set();
    return results.filter(result => {
      const key = result.url;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}

module.exports = GitHubRepositoryScanner;