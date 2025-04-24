// CodeGuardian - Azure Function for Code Analysis
// This function receives code changes and uses Azure OpenAI to analyze them

const { app } = require('@azure/functions');
const { OpenAIClient, AzureKeyCredential } = require("@azure/openai");
const { CosmosClient } = require('@azure/cosmos');

// Azure OpenAI configuration
const openaiEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
const openaiKey = process.env.AZURE_OPENAI_KEY;
const openaiDeployment = process.env.AZURE_OPENAI_DEPLOYMENT;

// Cosmos DB configuration
const cosmosEndpoint = process.env.COSMOS_DB_ENDPOINT;
const cosmosKey = process.env.COSMOS_DB_KEY;
const cosmosDatabase = process.env.COSMOS_DB_DATABASE || 'codeguardian';
const cosmosContainer = process.env.COSMOS_DB_CONTAINER || 'analysis-results';

// Initialize OpenAI client
const openaiClient = new OpenAIClient(
  openaiEndpoint,
  new AzureKeyCredential(openaiKey)
);

// Initialize Cosmos DB client
const cosmosClient = new CosmosClient({
  endpoint: cosmosEndpoint,
  key: cosmosKey
});

// Ensure database and container exist
async function initializeCosmosDB() {
  const { database } = await cosmosClient.databases.createIfNotExists({ id: cosmosDatabase });
  const { container } = await database.containers.createIfNotExists({ id: cosmosContainer });
  return container;
}

// Main function to analyze code changes
app.http('analyzeCode', {
  methods: ['POST'],
  authLevel: 'function',
  handler: async (request, context) => {
    context.log('Code analysis function triggered');
    
    try {
      const requestBody = await request.json();
      const { repoOwner, repoName, prNumber, files, commitSha } = requestBody;
      
      if (!files || !Array.isArray(files) || files.length === 0) {
        return {
          status: 400,
          body: JSON.stringify({ error: 'Invalid request. Files array required.' })
        };
      }
      
      // Initialize our container
      const container = await initializeCosmosDB();
      
      // Process each file
      const analysisResults = await Promise.all(
        files.map(file => analyzeFile(file, context))
      );
      
      // Combine results into a single analysis report
      const combinedAnalysis = generateAnalysisReport(analysisResults);
      
      // Store results in Cosmos DB
      const recordId = commitSha || `pr-${prNumber}-${Date.now()}`;
      await container.items.upsert({
        id: recordId,
        repoOwner,
        repoName,
        prNumber,
        commitSha,
        timestamp: new Date().toISOString(),
        analysis: combinedAnalysis
      });
      
      return {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(combinedAnalysis)
      };
    } catch (error) {
      context.log.error('Error in code analysis function:', error);
      
      return {
        status: 500,
        body: JSON.stringify({ error: 'Internal server error during code analysis' })
      };
    }
  }
});

// Analyze an individual file using Azure OpenAI
async function analyzeFile(file, context) {
  const { filename, content, patch, status } = file;
  
  // Skip deleted files
  if (status === 'removed') {
    return {
      filename,
      status,
      issues: [],
      suggestions: [],
      securityConcerns: [],
      analysisStatus: 'skipped'
    };
  }
  
  try {
    // Create a prompt for the OpenAI model to analyze the code
    const prompt = createAnalysisPrompt(filename, content, patch);
    
    // Call Azure OpenAI
    const result = await openaiClient.getChatCompletions(
      openaiDeployment,
      [
        { role: "system", content: "You are a code analysis expert that identifies bugs, security issues, and potential optimizations. Respond in JSON format with specific, actionable feedback." },
        { role: "user", content: prompt }
      ],
      {
        temperature: 0.1,
        max_tokens: 1500,
        response_format: { type: "json_object" }
      }
    );
    
    // Parse the response
    let analysisResult;
    try {
      analysisResult = JSON.parse(result.choices[0].message.content);
    } catch (e) {
      context.log.warn(`Failed to parse OpenAI response as JSON: ${result.choices[0].message.content}`);
      analysisResult = {
        issues: [],
        suggestions: [],
        securityConcerns: [],
        error: "Failed to parse analysis result"
      };
    }
    
    return {
      filename,
      status,
      ...analysisResult,
      analysisStatus: 'completed'
    };
  } catch (error) {
    context.log.error(`Error analyzing file ${filename}:`, error);
    return {
      filename,
      status,
      issues: [],
      suggestions: [],
      securityConcerns: [],
      analysisStatus: 'error',
      error: error.message
    };
  }
}

// Create a prompt for analyzing code
function createAnalysisPrompt(filename, content, patch) {
  // Determine the language from the file extension
  const fileExtension = filename.split('.').pop().toLowerCase();
  const fileType = getLanguageFromExtension(fileExtension);
  
  // If we have the full content, use it; otherwise, use the patch
  const codeToAnalyze = content || patch;
  
  return `
    Please analyze the following code from file "${filename}" written in ${fileType}.
    
    ${codeToAnalyze}
    
    Provide an analysis with the following sections in JSON format:
    1. issues: An array of potential bugs or code issues, each with a description, line number (if identifiable), and severity (high, medium, low)
    2. suggestions: An array of optimization or code quality suggestions, each with a description, line number (if applicable), and reasoning
    3. securityConcerns: An array of security vulnerabilities or concerns, each with a description, line number (if applicable), and recommended fix
    4. overallQuality: A brief assessment of the overall code quality (1-5 stars)
    5. testSuggestions: Suggestions for test cases that would help verify this code works correctly
    
    Respond only with valid JSON.
  `;
}

// Helper function to determine language from file extension
function getLanguageFromExtension(extension) {
  const languageMap = {
    'js': 'JavaScript',
    'ts': 'TypeScript',
    'py': 'Python',
    'java': 'Java',
    'cs': 'C#',
    'cpp': 'C++',
    'c': 'C',
    'go': 'Go',
    'rb': 'Ruby',
    'php': 'PHP',
    'swift': 'Swift',
    'kt': 'Kotlin',
    'rs': 'Rust',
    'html': 'HTML',
    'css': 'CSS',
    'scss': 'SCSS',
    'json': 'JSON',
    'md': 'Markdown',
    'sql': 'SQL',
    'sh': 'Shell',
    'yaml': 'YAML',
    'yml': 'YAML',
    'xml': 'XML',
    // Add more mappings as needed
  };
  
  return languageMap[extension] || 'Unknown';
}

// Generate a combined analysis report from individual file analyses
function generateAnalysisReport(fileAnalyses) {
  // Count total issues by severity
  const issueCount = { high: 0, medium: 0, low: 0 };
  const securityCount = { high: 0, medium: 0, low: 0 };
  let totalSuggestions = 0;
  
  fileAnalyses.forEach(analysis => {
    // Count issues by severity
    (analysis.issues || []).forEach(issue => {
      issueCount[issue.severity] = (issueCount[issue.severity] || 0) + 1;
    });
    
    // Count security concerns by severity
    (analysis.securityConcerns || []).forEach(concern => {
      securityCount[concern.severity] = (securityCount[concern.severity] || 0) + 1;
    });
    
    // Count suggestions
    totalSuggestions += (analysis.suggestions || []).length;
  });
  
  // Calculate overall score (simplified algorithm)
  const totalIssues = issueCount.high * 3 + issueCount.medium * 2 + issueCount.low;
  const totalSecurity = securityCount.high * 4 + securityCount.medium * 2 + securityCount.low;
  
  // Simple scoring algorithm (lower is better for issues/security concerns)
  const fileCount = fileAnalyses.length;
  let healthScore = 100;
  
  // Deduct points for issues and security concerns
  healthScore -= (totalIssues * 2) / fileCount;
  healthScore -= (totalSecurity * 4) / fileCount;
  
  // Add points for suggestions (up to a limit)
  healthScore += Math.min(totalSuggestions / fileCount * 1, 5);
  
  // Clamp score between 0-100
  healthScore = Math.max(0, Math.min(100, healthScore));
  
  return {
    summary: {
      filesAnalyzed: fileAnalyses.length,
      issueCount,
      securityCount,
      suggestionCount: totalSuggestions,
      healthScore: Math.round(healthScore)
    },
    fileAnalyses
  };
}

module.exports = app;