// CodeGuardian - Test Recommendation System
// This module generates appropriate test cases for code changes

const { OpenAIClient, AzureKeyCredential } = require("@azure/openai");

export interface TestRecommendationConfig {
  openaiEndpoint: string;
  openaiKey:      string;
  openaiDeployment: string;
  testFrameworks:   Record<string, string>;
}

class TestRecommendationSystem {

  private openaiEndpoint:    string;
  private openaiKey:         string;
  private openaiDeployment:  string;
  private openaiClient:      typeof OpenAIClient;
  private testFrameworks:    Record<string, string>;

  constructor(config) {
    this.openaiEndpoint   = config.openaiEndpoint;
    this.openaiKey        = config.openaiKey;
    this.openaiDeployment = config.openaiDeployment;
    this.testFrameworks   = config.testFrameworks;

    this.openaiClient = new OpenAIClient(
      this.openaiEndpoint,
      new AzureKeyCredential(this.openaiKey)
    );
    
    // Default test frameworks by language
    this.testFrameworks = config.testFrameworks ?? {
      'JavaScript': 'Jest',
      'TypeScript': 'Jest',
      'Python': 'pytest',
      'Java': 'JUnit',
      'C#': 'xUnit',
      'Ruby': 'RSpec',
      'Go': 'Go testing package',
      'PHP': 'PHPUnit',
      'Rust': 'Rust test module',
      // Add more as needed
    };
  }
  
  /**
   * Generate test recommendations for a specific file
   * @param {Object} fileInfo - Information about the file
   * @param {string} fileInfo.filename - The file name
   * @param {string} fileInfo.content - The file content
   * @param {string} fileInfo.language - The programming language
   * @param {Array} existingTests - Information about existing tests (optional)
   * @returns {Promise<Object>} Test recommendations
   */
  async generateTestRecommendations(fileInfo, existingTests = []) {
    const { filename, content, language } = fileInfo;
    
    // Skip test files themselves
    if (this.isTestFile(filename)) {
      return {
        filename,
        isTestFile: true,
        recommendations: []
      };
    }
    
    // Identify the appropriate test framework
    const testFramework = this.testFrameworks[language] || 'appropriate testing framework';
    
    // Create a prompt for the OpenAI model
    const prompt = this.createTestPrompt(filename, content, language, testFramework, existingTests);
    
    try {
      // Call Azure OpenAI
      const result = await this.openaiClient.getChatCompletions(
        this.openaiDeployment,
        [
          { 
            role: "system", 
            content: "You are a test engineering expert that creates effective test cases for code. Respond in JSON format with specific, actionable test recommendations." 
          },
          { role: "user", content: prompt }
        ],
        {
          temperature: 0.2,
          max_tokens: 2000,
          response_format: { type: "json_object" }
        }
      );
      
      // Parse the response
      let testRecommendations;
      try {
        testRecommendations = JSON.parse(result.choices[0].message.content);
      } catch (e) {
        console.warn(`Failed to parse OpenAI response as JSON: ${result.choices[0].message.content}`);
        testRecommendations = {
          testCases: [],
          testStrategy: "Unable to generate test strategy",
          error: "Failed to parse test recommendations"
        };
      }
      
      return {
        filename,
        language,
        testFramework,
        ...testRecommendations
      };
    } catch (error) {
      console.error(`Error generating test recommendations for ${filename}:`, error);
      return {
        filename,
        language,
        testFramework,
        testCases: [],
        testStrategy: "Error generating test recommendations",
        error: error.message
      };
    }
  }
  
  /**
   * Create a prompt for generating test recommendations
   */
  createTestPrompt(filename, content, language, testFramework, existingTests) {
    // Build information about existing tests if available
    let existingTestsInfo = '';
    if (existingTests && existingTests.length > 0) {
      existingTestsInfo = `
      The following tests already exist for this or related files:
      ${existingTests.map(test => `- ${test.filename}: ${test.description}`).join('\n')}
      
      Please avoid duplicating these test cases and focus on uncovered scenarios.
      `;
    }
    
    return `
    Please generate test recommendations for the following ${language} file:
    
    Filename: ${filename}
    
    Code:
    \`\`\`${language}
    ${content}
    \`\`\`
    
    ${existingTestsInfo}
    
    Provide test recommendations in JSON format with the following structure:
    1. testCases: An array of recommended test cases, each with:
       - description: A brief description of what the test verifies
       - scenario: The specific scenario being tested
       - expectedOutcome: What should happen when the test passes
       - mockRequirements: Any mocks or stubs needed (if applicable)
       - complexity: The estimated complexity of implementing this test (simple, moderate, complex)
       - priority: How important this test is (high, medium, low)
    2. testStrategy: A brief overall strategy for testing this code
    3. coverageGoals: Specific parts of the code that should be covered by tests
    4. testTemplate: A code snippet showing an example test using ${testFramework}
    
    Focus on:
    - Edge cases and error handling
    - Critical business logic
    - Functions with complex logic or many branches
    - Public API methods that would be called by other components
    
    Respond only with valid JSON.
    `;
  }
  
  /**
   * Check if a file is a test file based on naming conventions
   */
  isTestFile(filename) {
    const testPatterns = [
      /test[._-]/i,
      /[._-]test/i,
      /spec[._-]/i,
      /[._-]spec/i,
      /__tests__/,
      /\btest\b/i
    ];
    
    return testPatterns.some(pattern => pattern.test(filename));
  }
  
  /**
   * Generate test file name for a given source file
   */
  generateTestFileName(filename, language) {
    // Extract the base name without extension
    const lastDotIndex = filename.lastIndexOf('.');
    const baseName = lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename;
    const extension = lastDotIndex > 0 ? filename.substring(lastDotIndex + 1) : '';
    
    // Generate test file name based on language conventions
    switch (language) {
      case 'JavaScript':
      case 'TypeScript':
        const jsExtension = language === 'JavaScript' ? 'js' : 'ts';
        return `${baseName}.test.${jsExtension}`;
      case 'Python':
        return `test_${baseName}.py`;
      case 'Java':
        return `${baseName}Test.java`;
      case 'C#':
        return `${baseName}Tests.cs`;
      case 'Ruby':
        return `${baseName}_spec.rb`;
      case 'Go':
        return `${baseName}_test.go`;
      default:
        return `${baseName}_test.${extension}`;
    }
  }
}

module.exports = TestRecommendationSystem;