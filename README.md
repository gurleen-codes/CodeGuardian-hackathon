# CodeGuardian: AI-Powered Code Quality Assistant

CodeGuardian is an intelligent AI agent that integrates seamlessly with GitHub workflows to enhance code quality, catch bugs early, and accelerate development through smart recommendations. It serves as your team's expert companion throughout the development lifecycle.

## 🚀 Features

- **Pre-Commit Bug Detection**: Analyzes code changes to identify potential bugs, security vulnerabilities, and code smells before they make it into the codebase
- **Codebase-Specific Optimization**: Provides tailored optimization suggestions based on your team's specific coding patterns and project requirements
- **Intelligent Test Case Generation**: Recommends targeted test cases for new code changes, ensuring comprehensive coverage
- **Open Source Intelligence**: Scans GitHub repositories for similar code patterns and their associated issues to proactively prevent known problems

## 🏗️ Architecture

CodeGuardian consists of several key components:

1. **GitHub App Integration**: Hooks into PR/commit events via GitHub API
2. **Code Analysis Engine**: Leverages Azure OpenAI to understand code semantics
3. **Test Recommendation System**: Generates appropriate test cases
4. **GitHub Repository Scanner**: Identifies similar code patterns from public repos
5. **User Interface**: Dashboard to review suggestions and configure settings

## 🛠️ Technical Stack

- **Backend**: 
  - Python 3.8+ with FastAPI
  - Node.js with Express
- **AI Services**: Azure OpenAI
- **Cloud Functions**: Azure Functions
- **Database**: Azure Cosmos DB
- **Frontend**: React.js
- **API Integration**: GitHub API
- **Containerization**: Docker/Azure Container Apps

## 📋 Project Structure

```
codeguardian/
├── agents/               # AI agent implementations
├── config/              # Configuration files
├── utils/               # Utility functions
├── data/                # Data storage and processing
├── github-app/          # GitHub App integration code
├── azure-functions/     # Azure Functions for code analysis
├── services/
│   ├── test-recommender/  # Test recommendation system
│   └── repo-scanner/      # GitHub repository scanner
├── frontend/            # React dashboard UI
├── docs/                # Documentation
└── scripts/             # Setup and deployment scripts
```

## 🚦 Getting Started

### Prerequisites

- Python 3.8 or higher
- Node.js 16+
- Azure account with OpenAI service enabled
- GitHub account with permissions to create GitHub Apps
- Docker (optional, for containerization)

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/codeguardian.git
   cd codeguardian
   ```

2. **Set up Python environment**
   ```bash
   # Create and activate virtual environment
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   
   # Install Python dependencies
   pip install -r requirements.txt
   ```

3. **Install Node.js dependencies**
   ```bash
   npm install
   ```

4. **Create a GitHub App**
   - Go to your GitHub account settings → Developer settings → GitHub Apps
   - Create a new GitHub App with the following permissions:
     - Repository contents: Read
     - Pull requests: Read & Write
     - Commits: Read
     - Issues: Read
   - Generate and download a private key
   - Note the App ID, Client ID, and Client Secret

5. **Set up environment variables**
   Create a `.env` file with the following variables:
   ```
   # GitHub App Configuration
   GITHUB_APP_ID=your_app_id
   GITHUB_PRIVATE_KEY=your_private_key
   GITHUB_WEBHOOK_SECRET=your_webhook_secret
   GITHUB_CLIENT_ID=your_client_id
   GITHUB_CLIENT_SECRET=your_client_secret
   
   # Azure OpenAI Configuration
   AZURE_OPENAI_ENDPOINT=your_openai_endpoint
   AZURE_OPENAI_KEY=your_openai_key
   AZURE_OPENAI_DEPLOYMENT=your_deployment_name
   
   # Azure Cosmos DB
   COSMOS_DB_ENDPOINT=your_cosmos_endpoint
   COSMOS_DB_KEY=your_cosmos_key
   COSMOS_DB_DATABASE=codeguardian
   COSMOS_DB_CONTAINER=analysis-results
   
   # Server Configuration
   PORT=3000
   NODE_ENV=development
   ```

6. **Start the development servers**
   ```bash
   # Start Python backend
   uvicorn main:app --reload
   
   # In a separate terminal, start Node.js frontend
   npm run dev
   ```

7. **Run tests**
   ```bash
   # Python tests
   pytest
   
   # Node.js tests
   npm test
   ```

8. **Deploy Azure Functions**
   ```bash
   cd azure-functions
   npm run deploy
   ```

## 🔄 Workflow

1. Developer creates or updates a pull request
2. CodeGuardian GitHub App receives the webhook event
3. The app sends code changes to the analysis engine
4. The analysis engine identifies issues and suggestions
5. Test recommendations are generated based on the changes
6. Similar code patterns are found from other repositories
7. Results are combined and presented as comments on the PR
8. Developer reviews and addresses the feedback

## 📊 Dashboard

The CodeGuardian dashboard provides:

- Overview of code quality metrics across repositories
- History of analyses and detected issues
- Configuration options for analysis sensitivity
- Project-specific settings and preferences

## 🧪 Testing

The project includes comprehensive testing:

- Python unit tests using pytest
- Node.js tests using Jest
- Integration tests for API endpoints
- End-to-end tests for critical workflows

Run tests using:
```bash
# Python tests
pytest

# Node.js tests
npm test
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

For questions and support, please open an issue on the GitHub repository or contact the maintainers directly.