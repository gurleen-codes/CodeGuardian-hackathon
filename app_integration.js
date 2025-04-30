// Handler for new pull requests
async function handlePullRequestOpened({ payload, octokit }) {
  console.log(`New PR opened: ${payload.pull_request.html_url}`);
  
  try {
    // Get the PR details
    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;
    const pull_number = payload.pull_request.number;
    
    // Post initial comment to show we're analyzing
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: pull_number,
      body: `## 🛡️ CodeGuardian Analysis\n\nAnalyzing code changes and preparing recommendations...\nA full report will be available shortly.`,
    });
    
    // Get the files changed in the PR
    const { data: files } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number,
    });
    
    // Analyze code changes
    const analysisResult = await analyzeCodeChanges(octokit, payload, files);
    
    // Generate test recommendations
    const testRecommendations = await generateTestRecommendations(octokit, payload, files);
    
    // If we have test recommendations, add them to the analysis result
    if (testRecommendations) {
      analysisResult.testRecommendations = testRecommendations;
      
      // Post updated analysis results with test recommendations
      await postAnalysisResults(octokit, owner, repo, pull_number, null, analysisResult, false);
    }
    
    // Check if similar code patterns should be found
    if (process.env.ENABLE_SIMILAR_CODE_SEARCH === 'true') {
      // This would be a separate process that could take longer
      setTimeout(async () => {
        try {
          const similarPatterns = await findSimilarCodePatterns(octokit, payload, files);
          if (similarPatterns && similarPatterns.length > 0) {
            await postSimilarPatterns(octokit, owner, repo, pull_number, similarPatterns);
          }
        } catch (error) {
          console.error('Error finding similar code patterns:', error);
        }
      }, 1000);
    }
  } catch (error) {
    console.error('Error handling PR opened event:', error);
  }
}

// Handler for PR updates
async function handlePullRequestSynchronize({ payload, octokit }) {
  console.log(`PR updated: ${payload.pull_request.html_url}`);
  
  try {
    // Get the PR details
    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;
    const pull_number = payload.pull_request.number;
    
    // Get the files changed in the PR
    const { data: files } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number,
    });
    
    // Add a comment that we're re-analyzing
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: pull_number,
      body: `## 🔄 CodeGuardian Re-analysis\n\nChanges detected. Re-analyzing code...`,
    });
    
    // Re-analyze code changes
    const analysisResult = await analyzeCodeChanges(octokit, payload, files);
    
    // Generate new test recommendations
    const testRecommendations = await generateTestRecommendations(octokit, payload, files);
    
    // If we have test recommendations, add them to the analysis result
    if (testRecommendations) {
      analysisResult.testRecommendations = testRecommendations;
    }
    
    // Post updated analysis
    await postAnalysisResults(octokit, owner, repo, pull_number, null, analysisResult, false);
  } catch (error) {
    console.error('Error handling PR synchronize event:', error);
  }
}// CodeGuardian - GitHub App Integration

// Required dependencies
const express = require('express');
const { Octokit } = require('@octokit/rest');
const { createNodeMiddleware } = require('@octokit/webhooks');
const { App } = require('@octokit/app');
const crypto = require('crypto');
const dotenv = require('dotenv');
const cors = require('cors');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// GitHub App configuration
const appId = process.env.GITHUB_APP_ID;
const privateKey = process.env.GITHUB_PRIVATE_KEY;
const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
const clientId = process.env.GITHUB_CLIENT_ID;
const clientSecret = process.env.GITHUB_CLIENT_SECRET;

// Initialize GitHub App
const githubApp = new App({
  appId,
  privateKey,
  webhooks: {
    secret: webhookSecret
  },
});

// Initialize webhooks handling
const webhooks = githubApp.webhooks;

// Setup webhook event handlers
webhooks.on('pull_request.opened', handlePullRequestOpened);
webhooks.on('pull_request.synchronize', handlePullRequestSynchronize);
webhooks.on('push', handlePushEvent);

// Handler for new pull requests
async function handlePullRequestOpened({ payload, octokit }) {
  console.log(`New PR opened: ${payload.pull_request.html_url}`);
  
  try {
    // Get the PR details
    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;
    const pull_number = payload.pull_request.number;
    
    // Get the files changed in the PR
    const { data: files } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number,
    });
    
    // Analyze code changes (to be implemented)
    await analyzeCodeChanges(octokit, payload, files);
    
    // Generate test recommendations (to be implemented)
    await generateTestRecommendations(octokit, payload, files);
    
    // Post initial comment on the PR
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: pull_number,
      body: `## 🛡️ CodeGuardian Analysis\n\nAnalyzing code changes and preparing recommendations...\nA full report will be available shortly.`,
    });
  } catch (error) {
    console.error('Error handling PR opened event:', error);
  }
}

// Handler for PR updates
async function handlePullRequestSynchronize({ payload, octokit }) {
  console.log(`PR updated: ${payload.pull_request.html_url}`);
  
  try {
    // Similar implementation to handlePullRequestOpened
    // We'll re-analyze when changes are pushed to the PR
    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;
    const pull_number = payload.pull_request.number;
    
    const { data: files } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number,
    });
    
    // Re-analyze code changes
    await analyzeCodeChanges(octokit, payload, files);
  } catch (error) {
    console.error('Error handling PR synchronize event:', error);
  }
}

// Handler for push events (commits to a branch)
async function handlePushEvent({ payload, octokit }) {
  console.log(`New push to ${payload.repository.full_name}, ref: ${payload.ref}`);
  
  // Only process pushes to specific branches if needed
  // For example, ignore pushes to main/master for pre-commit analysis
  if (payload.ref === 'refs/heads/main' || payload.ref === 'refs/heads/master') {
    // For main branches, we might still want to run analysis but not post comments
    // This could be used to update metrics in the dashboard
    if (process.env.ANALYZE_MAIN_BRANCH === 'true') {
      try {
        // Get the commit details
        const owner = payload.repository.owner.login;
        const repo = payload.repository.name;
        const commit_sha = payload.after;
        
        // Get the files changed in the commit
        const { data: commit } = await octokit.repos.getCommit({
          owner,
          repo,
          ref: commit_sha,
        });
        
        // Analyze code changes but don't post comments
        await analyzeCodeChanges(octokit, payload, commit.files, true);
      } catch (error) {
        console.error('Error analyzing main branch push:', error);
      }
    }
    return;
  }
  
  try {
    // Get the commit details
    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;
    const commit_sha = payload.after;
    
    // Get the files changed in the commit
    const { data: commit } = await octokit.repos.getCommit({
      owner,
      repo,
      ref: commit_sha,
    });
    
    // Analyze code changes in the commit
    const analysisResult = await analyzeCodeChanges(octokit, payload, commit.files, true);
    
    // For commits, we usually don't post comments directly to avoid noise
    // Instead, we store the results and display them in the dashboard
    // But if configured to do so, we can post a comment
    if (process.env.POST_COMMIT_COMMENTS === 'true') {
      // Generate test recommendations 
      const testRecommendations = await generateTestRecommendations(octokit, payload, commit.files);
      
      // If we have test recommendations, add them to the analysis result
      if (testRecommendations) {
        analysisResult.testRecommendations = testRecommendations;
      }
      
      // Post as a commit comment
      await postAnalysisResults(octokit, owner, repo, null, commit_sha, analysisResult, true);
    }
  } catch (error) {
    console.error('Error handling push event:', error);
  }
}

// Analyze code changes using Azure Function
async function analyzeCodeChanges(octokit, payload, files, isPush = false) {
  console.log(`Analyzing ${files.length} files`);
  
  try {
    // Repository info
    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;
    
    // Determine if this is a PR or commit
    const prNumber = payload.pull_request?.number;
    const commitSha = isPush ? payload.after : payload.pull_request?.head.sha;
    
    // For each file, get the content if it's not removed
    const filesToAnalyze = [];
    
    for (const file of files) {
      // Skip deleted files
      if (file.status === 'removed') {
        console.log(`Skipping deleted file: ${file.filename}`);
        continue;
      }
      
      try {
        // If we already have the content (from GitHub API), use it
        if (file.content) {
          filesToAnalyze.push({
            filename: file.filename,
            content: file.content,
            status: file.status,
            patch: file.patch
          });
          continue;
        }
        
        // Otherwise, fetch the content
        let content;
        if (isPush) {
          // For push events, get content from the commit
          const { data: fileData } = await octokit.repos.getContent({
            owner,
            repo,
            path: file.filename,
            ref: commitSha
          });
          
          if (fileData.content && fileData.encoding === 'base64') {
            content = Buffer.from(fileData.content, 'base64').toString('utf8');
          }
        } else {
          // For PR events, get the content from the PR
          const { data: fileContent } = await octokit.repos.getContent({
            owner,
            repo,
            path: file.filename,
            ref: payload.pull_request.head.sha
          });
          
          if (fileContent.content && fileContent.encoding === 'base64') {
            content = Buffer.from(fileContent.content, 'base64').toString('utf8');
          }
        }
        
        if (content) {
          filesToAnalyze.push({
            filename: file.filename,
            content: content,
            status: file.status,
            patch: file.patch
          });
        } else {
          console.log(`Could not get content for file ${file.filename}`);
        }
      } catch (error) {
        console.error(`Error getting content for file ${file.filename}:`, error.message);
      }
    }
    
    // If no files to analyze, exit early
    if (filesToAnalyze.length === 0) {
      console.log('No files to analyze after filtering');
      return;
    }
    
    // Prepare data for Azure Function
    const analysisData = {
      repoOwner: owner,
      repoName: repo,
      prNumber: prNumber,
      commitSha: commitSha,
      files: filesToAnalyze
    };
    
    // Call Azure Function for analysis
    const analysisResult = await callAnalysisFunction(analysisData);
    
    // Post results as a comment on the PR or commit
    await postAnalysisResults(octokit, owner, repo, prNumber, commitSha, analysisResult, isPush);
    
    return analysisResult;
  } catch (error) {
    console.error('Error in analyzeCodeChanges:', error);
    throw error;
  }
}

// Placeholder for test recommendation function
async function generateTestRecommendations(octokit, payload, files) {
  console.log(`Generating test recommendations for ${files.length} files`);
  
  // TODO: Implement test recommendation logic
  // This will be expanded in the next implementation phase
}

// Set up the express middleware to handle webhook events
app.use(createNodeMiddleware(webhooks));

// API endpoints for the dashboard and manual triggers

// API endpoint to manually trigger analysis on a PR
app.post('/api/analyze-pr', async (req, res) => {
  try {
    const { owner, repo, prNumber, installationId } = req.body;
    
    if (!owner || !repo || !prNumber || !installationId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Get an authenticated client for this installation
    const octokit = await getAuthenticatedClient(installationId);
    
    // Get PR details
    const { data: pullRequest } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber
    });
    
    // Get files in the PR
    const { data: files } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber
    });
    
    // Create a simplified payload
    const payload = {
      repository: {
        owner: {
          login: owner
        },
        name: repo
      },
      pull_request: pullRequest
    };
    
    // Add a comment that we're analyzing
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: `## 🛡️ CodeGuardian Manual Analysis\n\nAnalyzing code at your request...`,
    });
    
    // Start the analysis (async)
    analyzeCodeChanges(octokit, payload, files).then(async (analysisResult) => {
      // Generate test recommendations
      const testRecommendations = await generateTestRecommendations(octokit, payload, files);
      
      // If we have test recommendations, add them to the analysis result
      if (testRecommendations) {
        analysisResult.testRecommendations = testRecommendations;
      }
      
      // Post results
      await postAnalysisResults(octokit, owner, repo, prNumber, null, analysisResult, false);
    }).catch(err => {
      console.error('Error in manual PR analysis:', err);
    });
    
    res.json({ message: 'Analysis triggered', prNumber });
  } catch (error) {
    console.error('Error in analyze-pr endpoint:', error);
    res.status(500).json({ error: 'Failed to trigger analysis' });
  }
});

// API endpoint to manually trigger analysis on a specific commit
app.post('/api/analyze-commit', async (req, res) => {
  try {
    const { owner, repo, commitSha, installationId } = req.body;
    
    if (!owner || !repo || !commitSha || !installationId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Get an authenticated client for this installation
    const octokit = await getAuthenticatedClient(installationId);
    
    // Get commit details
    const { data: commit } = await octokit.repos.getCommit({
      owner,
      repo,
      ref: commitSha
    });
    
    // Create a simplified payload
    const payload = {
      repository: {
        owner: {
          login: owner
        },
        name: repo
      },
      after: commitSha
    };
    
    // Start the analysis (async)
    analyzeCodeChanges(octokit, payload, commit.files, true).then(async (analysisResult) => {
      // Generate test recommendations
      const testRecommendations = await generateTestRecommendations(octokit, payload, commit.files);
      
      // If we have test recommendations, add them to the analysis result
      if (testRecommendations) {
        analysisResult.testRecommendations = testRecommendations;
      }
      
      // Post results as a commit comment
      await postAnalysisResults(octokit, owner, repo, null, commitSha, analysisResult, true);
    }).catch(err => {
      console.error('Error in manual commit analysis:', err);
    });
    
    res.json({ message: 'Analysis triggered', commitSha });
  } catch (error) {
    console.error('Error in analyze-commit endpoint:', error);
    res.status(500).json({ error: 'Failed to trigger analysis' });
  }
});

// API endpoint to search for similar code patterns
app.post('/api/find-similar-code', async (req, res) => {
  try {
    const { owner, repo, prNumber, installationId } = req.body;
    
    if (!owner || !repo || !prNumber || !installationId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Get an authenticated client for this installation
    const octokit = await getAuthenticatedClient(installationId);
    
    // Get PR details
    const { data: pullRequest } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber
    });
    
    // Get files in the PR
    const { data: files } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber
    });
    
    // Create a simplified payload
    const payload = {
      repository: {
        owner: {
          login: owner
        },
        name: repo
      },
      pull_request: pullRequest
    };
    
    // Add a comment that we're searching
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: `## 🔍 CodeGuardian Similar Code Search\n\nSearching for similar code patterns across GitHub repositories...`,
    });
    
    // Start the search (async)
    findSimilarCodePatterns(octokit, payload, files).then(async (patterns) => {
      if (patterns && patterns.length > 0) {
        await postSimilarPatterns(octokit, owner, repo, prNumber, patterns);
      } else {
        await octokit.issues.createComment({
          owner,
          repo,
          issue_number: prNumber,
          body: `## 🔍 CodeGuardian Similar Code Search\n\nNo significant similar code patterns found.`,
        });
      }
    }).catch(err => {
      console.error('Error in similar code search:', err);
    });
    
    res.json({ message: 'Similar code search triggered', prNumber });
  } catch (error) {
    console.error('Error in find-similar-code endpoint:', error);
    res.status(500).json({ error: 'Failed to trigger similar code search' });
  }
});

// API endpoint to list repositories that have the app installed
app.get('/api/repositories', async (req, res) => {
  try {
    // List all installations
    const installations = await githubApp.octokit.apps.listInstallations();
    
    const repositories = [];
    
    // For each installation, get the repositories
    for (const installation of installations.data) {
      const installationOctokit = await getAuthenticatedClient(installation.id);
      
      const installRepos = await installationOctokit.apps.listReposAccessibleToInstallation();
      
      for (const repo of installRepos.data.repositories) {
        repositories.push({
          id: repo.id,
          fullName: repo.full_name,
          name: repo.name,
          owner: repo.owner.login,
          installationId: installation.id,
          url: repo.html_url
        });
      }
    }
    
    res.json(repositories);
  } catch (error) {
    console.error('Error fetching repositories:', error);
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

// API endpoint to get analysis results for a repository
app.get('/api/repositories/:repoId/analyses', async (req, res) => {
  try {
    const { repoId } = req.params;
    
    // Query Cosmos DB for analyses for this repository
    const container = cosmosClient.database(process.env.COSMOS_DB_DATABASE).container(process.env.COSMOS_DB_CONTAINER);
    
    const querySpec = {
      query: "SELECT * FROM c WHERE c.repositoryId = @repoId ORDER BY c.timestamp DESC",
      parameters: [
        {
          name: "@repoId",
          value: repoId
        }
      ]
    };
    
    const { resources: analyses } = await container.items.query(querySpec).fetchAll();
    
    res.json(analyses);
  } catch (error) {
    console.error('Error fetching analyses:', error);
    res.status(500).json({ error: 'Failed to fetch analyses' });
  }
});

// Helper function to get an authenticated client for an installation
async function getAuthenticatedClient(installationId) {
  const octokit = await githubApp.getInstallationOctokit(installationId);
  return octokit;
}

// Placeholder for finding similar code patterns
async function findSimilarCodePatterns(octokit, payload, files) {
  try {
    // For each file, get the content
    const filesToAnalyze = [];
    
    for (const file of files) {
      // Skip deleted files
      if (file.status === 'removed') {
        continue;
      }
      
      try {
        // If we already have the content, use it
        if (file.content) {
          filesToAnalyze.push({
            filename: file.filename,
            content: file.content,
            language: getLanguageFromFilename(file.filename)
          });
          continue;
        }
        
        // Otherwise, fetch the content
        let content;
        if (payload.pull_request) {
          // For PR events, get the content from the PR
          const { data: fileContent } = await octokit.repos.getContent({
            owner: payload.repository.owner.login,
            repo: payload.repository.name,
            path: file.filename,
            ref: payload.pull_request.head.sha
          });
          
          if (fileContent.content && fileContent.encoding === 'base64') {
            content = Buffer.from(fileContent.content, 'base64').toString('utf8');
          }
        } else {
          // For commit events, get content from the commit
          const { data: fileData } = await octokit.repos.getContent({
            owner: payload.repository.owner.login,
            repo: payload.repository.name,
            path: file.filename,
            ref: payload.after
          });
          
          if (fileData.content && fileData.encoding === 'base64') {
            content = Buffer.from(fileData.content, 'base64').toString('utf8');
          }
        }
        
        if (content) {
          filesToAnalyze.push({
            filename: file.filename,
            content: content,
            language: getLanguageFromFilename(file.filename)
          });
        }
      } catch (error) {
        console.error(`Error getting content for file ${file.filename}:`, error.message);
      }
    }
    
    // Call the Repository Scanner service
    const scannerUrl = process.env.REPO_SCANNER_URL + '/api/find-similar-patterns';
    
    console.log(`Calling Repository Scanner at ${scannerUrl}`);
    
    const response = await fetch(scannerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        files: filesToAnalyze
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Repository scanner call failed with status ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    console.log('Similar patterns found:', result.patterns.length);
    
    return result.patterns;
  } catch (error) {
    console.error('Error finding similar code patterns:', error);
    return [];
  }
}

// Post similar patterns as a comment
async function postSimilarPatterns(octokit, owner, repo, prNumber, patterns) {
  try {
    // Format the patterns into a readable comment
    let comment = `## 🔍 CodeGuardian Similar Code Patterns\n\n`;
    
    comment += `CodeGuardian found ${patterns.length} similar code patterns across GitHub repositories that may be relevant to your changes.\n\n`;
    
    // Sort patterns by similarity score
    const sortedPatterns = [...patterns].sort((a, b) => b.similarityScore - a.similarityScore);
    
    // Show top patterns (limit to 5 for readability)
    const patternsToShow = sortedPatterns.slice(0, 5);
    
    patternsToShow.forEach((pattern, index) => {
      comment += `### Pattern ${index + 1}: ${pattern.primaryFeature}\n`;
      comment += `📚 Found in: [${pattern.sourceRepository}](${pattern.sourceUrl})\n`;
      comment += `💯 Similarity score: ${Math.round(pattern.similarityScore * 100)}%\n\n`;
      
      // If there are related issues, show them
      if (pattern.relatedIssues && pattern.relatedIssues.length > 0) {
        comment += `#### Related Issues:\n`;
        pattern.relatedIssues.slice(0, 3).forEach(issue => {
          const status = issue.state === 'open' ? '🟢 Open' : '🔴 Closed';
          comment += `- [${issue.title}](${issue.url}) (${status})\n`;
        });
        comment += `\n`;
      }
      
      // Show a small code snippet
      if (pattern.codeSnippet) {
        // Extract just a relevant portion (first 10-15 lines)
        const snippetLines = pattern.codeSnippet.split('\n').slice(0, 15);
        const snippet = snippetLines.join('\n');
        
        comment += `<details>\n<summary>Code snippet</summary>\n\n\`\`\`\n${snippet}\n`;
        if (snippetLines.length < pattern.codeSnippet.split('\n').length) {
          comment += `... (truncated)\n`;
        }
        comment += `\`\`\`\n</details>\n\n`;
      }
      
      // Add a separator between patterns
      if (index < patternsToShow.length - 1) {
        comment += `---\n\n`;
      }
    });
    
    // If there are more patterns than we showed
    if (sortedPatterns.length > patternsToShow.length) {
      comment += `\n\n*${sortedPatterns.length - patternsToShow.length} more similar patterns found. View them on the dashboard.*\n`;
    }
    
    // Footer
    comment += `\n---\n📊 [View all similar patterns on the CodeGuardian dashboard](${process.env.DASHBOARD_URL || '#'})`;
    
    // Post the comment
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: comment
    });
    
    console.log(`Posted similar patterns to PR #${prNumber}`);
  } catch (error) {
    console.error('Error posting similar patterns:', error);
  }
}

// Initialize Cosmos DB client
const cosmosClient = new CosmosClient({
  endpoint: process.env.COSMOS_DB_ENDPOINT,
  key: process.env.COSMOS_DB_KEY
});

// Initialize database and container
async function initializeCosmosDB() {
  try {
    const { database } = await cosmosClient.databases.createIfNotExists({
      id: process.env.COSMOS_DB_DATABASE || 'codeguardian'
    });
    
    const { container } = await database.containers.createIfNotExists({
      id: process.env.COSMOS_DB_CONTAINER || 'analysis-results',
      partitionKey: { paths: ["/repositoryId"] }
    });
    
    console.log('Cosmos DB initialized successfully');
    return container;
  } catch (error) {
    console.error('Failed to initialize Cosmos DB:', error);
    throw error;
  }
}

// Initialize Cosmos DB when the app starts
let cosmosContainer;
(async () => {
  try {
    cosmosContainer = await initializeCosmosDB();
  } catch (error) {
    console.error('Error initializing Cosmos DB:', error);
  }
})();

// Status endpoint
app.get('/status', (req, res) => {
  res.json({ 
    status: 'active', 
    name: 'CodeGuardian GitHub App',
    version: '1.0.0',
    services: {
      github: 'connected',
      cosmosDb: cosmosContainer ? 'connected' : 'disconnected',
      openAi: process.env.AZURE_OPENAI_ENDPOINT ? 'configured' : 'not configured'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`CodeGuardian GitHub App running on port ${PORT}`);
});

// Export for serverless environments if needed
module.exports = app;