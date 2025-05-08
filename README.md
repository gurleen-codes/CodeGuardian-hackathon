# CodeGuardian: AI-Powered Code Quality Assistant

CodeGuardian is an intelligent AI agent that analyzes code to enhance quality, catch bugs early, and accelerate development through smart recommendations. It serves as your team's expert companion throughout the development lifecycle.

## 🚀 Features

- **Code Analysis**: Analyzes code to identify potential bugs, security vulnerabilities, and code smells
- **Codebase-Specific Optimization**: Provides tailored optimization suggestions based on your specific coding patterns
- **Intelligent Test Case Generation**: Recommends targeted test cases for code changes
- **Code Pattern Recognition**: Identifies similar code patterns and their associated issues

## 🏗️ Architecture

CodeGuardian consists of several key components:

1. **Code Analysis Engine**: Leverages OpenAI to understand code semantics
2. **Test Recommendation System**: Generates appropriate test cases
3. **Pattern Recognition**: Identifies similar code patterns
4. **User Interface**: Simple dashboard to review suggestions

## 🛠️ Technical Stack

- **Backend**: Python 3.8+ with FastAPI
- **AI Services**: OpenAI API
- **Frontend**: React.js (optional)
- **Database**: Local JSON storage (for hackathon)

## 📋 Project Structure

```
codeguardian/
├── agents/               # AI agent implementations
├── config/              # Configuration files
├── utils/               # Utility functions
├── data/                # Data storage and processing
└── frontend/            # React dashboard UI (optional)
```

## 🚦 Getting Started

### Prerequisites

- Python 3.8 or higher
- OpenAI API key

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

3. **Set up environment variables**
   Create a `.env` file with the following variables:
   ```
   # OpenAI Configuration
   OPENAI_API_KEY=your_openai_api_key
   
   # Server Configuration
   PORT=3000
   ```

4. **Start the development server**
   ```bash
   # Start Python backend
   uvicorn main:app --reload
   ```

5. **Run tests**
   ```bash
   # Python tests
   pytest
   ```

## 🔄 Basic Usage

1. Send code snippets to the API endpoint:
   ```bash
   curl -X POST http://localhost:3000/analyze \
     -H "Content-Type: application/json" \
     -d '{"code": "your code here"}'
   ```

2. Get analysis results including:
   - Potential bugs and issues
   - Optimization suggestions
   - Test case recommendations
   - Similar code patterns

## 🧪 Testing

The project includes basic testing:

- Python unit tests using pytest
- API endpoint tests
- Basic integration tests

Run tests using:
```bash
pytest
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request


## Project Team:

Gurleen Bajwa
Email: gurleen5bajwa@gmail.com

Trisha Gupta
Email: trishagupta1804@gmail.com

Ilyes Sais
Email: ilyessais2000@gmail.com


## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

For questions and support, please open an issue on the GitHub repository or contact the maintainers directly.
