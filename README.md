# Reverse Project Engineer

A comprehensive Node.js + Express + Mongoose + Vue 3 application that analyzes existing codebases and syncs them with Jira for project management. Perfect for when you have an existing codebase but no documentation or project structure in Jira.

## Features

### 🔍 **Code Analysis**
- **Multi-language support**: JavaScript/TypeScript, C#, Python, and 50+ other languages
- **Intelligent grouping**: Automatically groups files into logical Components → Modules → Artifacts
- **Dependency mapping**: Builds comprehensive dependency graphs and relationship hierarchies
- **Git integration**: Extracts historical timeline data, commit patterns, and effort estimates

### 🎯 **Jira Integration**
- **Smart mapping**: Maps code entities to Jira issue types (Epics, Stories, Tasks, Sub-tasks, etc.)
- **Historical backfilling**: Creates realistic timelines using Git history for worklogs
- **Dry-run preview**: See exactly what will be created before applying changes
- **Rate-limited sync**: Respects Jira API limits with intelligent queuing and retries
- **Idempotent operations**: Safe to re-run without creating duplicates

### 📊 **Advanced Features**
- **Custom field mapping**: Set actual start/finish dates and estimates from Git data
- **Status transitions**: Automatically transition issues to reflect historical completion
- **Link relationships**: Creates proper issue links for dependencies and ownership
- **Confluence export**: Optional summary pages per Epic with dependency diagrams

## Tech Stack

### Backend
- **Node.js 20+** with TypeScript
- **Express** for REST API
- **Mongoose** for MongoDB data modeling
- **BullMQ** with Redis for job queuing
- **Axios** for HTTP requests with rate limiting
- **Zod** for input validation
- **Winston** for logging
- **Jest** for testing

### Frontend  
- **Vue 3** with Composition API
- **Vite** for fast development and building
- **Pinia** for state management
- **Vue Router** for navigation
- **Tailwind CSS** for styling
- **TypeScript** throughout

### Infrastructure
- **MongoDB** for data persistence
- **Redis** for caching and job queues
- **Docker** with Docker Compose
- **Nginx** for production frontend serving

## Quick Start

### Prerequisites
- Node.js 20+
- Docker and Docker Compose (recommended)
- Git
- Jira Cloud instance with API access

### Option 1: Docker (Recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/atomdellow/ReverseProjectEngineer.git
   cd ReverseProjectEngineer
   ```

2. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start services**
   ```bash
   npm run docker:up
   ```

4. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000/api
   - MongoDB: localhost:27017
   - Redis: localhost:6379

### Option 2: Local Development

1. **Clone and setup**
   ```bash
   git clone https://github.com/atomdellow/ReverseProjectEngineer.git
   cd ReverseProjectEngineer
   npm install
   ```

2. **Start MongoDB and Redis**
   ```bash
   # Using Docker
   docker run -d -p 27017:27017 --name rpe-mongo mongo:7.0
   docker run -d -p 6379:6379 --name rpe-redis redis:7.2-alpine
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

4. **Start backend**
   ```bash
   cd app/backend
   npm install
   npm run dev
   ```

5. **Start frontend** (new terminal)
   ```bash
   cd app/frontend  
   npm install
   npm run dev
   ```

## Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```env
# Database
MONGO_URI=mongodb://localhost:27017/rpe
REDIS_URL=redis://localhost:6379

# Security
APP_SECRET=your-super-secret-32-char-plus-key-here

# Jira Configuration
ATLASSIAN_SITE=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-jira-api-token

# Optional
API_KEY=dev-api-key
LOG_LEVEL=info
NODE_ENV=development
```

### Jira API Token Setup

1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Give it a label like "Reverse Project Engineer"
4. Copy the token to your `.env` file

### Jira Permissions Required

Your Jira user needs:
- **Browse Projects** permission
- **Create Issues** permission  
- **Edit Issues** permission
- **Add Comments** permission
- **Work On Issues** permission (for worklogs)
- **Link Issues** permission

## Usage

### 1. Analyze Your Codebase

1. Navigate to the **Analyze** page
2. Enter the full paths to your repositories:
   ```
   /path/to/your/frontend-repo
   /path/to/your/backend-repo
   ```
3. Configure analysis settings:
   - **Max Depth**: How deep to scan directories (default: 10)
   - **Include Tests**: Whether to analyze test files
   - **Languages**: Specific languages to focus on (optional)
4. Click **Start Analysis**

The analyzer will:
- Scan all files in your repositories
- Detect languages and file roles (controller, service, model, etc.)
- Build dependency graphs
- Extract Git history and timeline data
- Group files into logical components and modules

### 2. Preview Jira Sync

1. After analysis completes, go to **Preview**
2. Review the proposed issue structure:
   - **Components** → **Epics**
   - **Modules** → **Stories** 
   - **Artifacts** → **Tasks/Sub-tasks**
3. Check the mapping and relationships
4. Verify timeline data and effort estimates

### 3. Apply to Jira

1. Go to **Apply** page
2. Choose your rate limit (requests per minute)
3. Decide between dry-run or actual execution
4. Monitor the progress as issues are created
5. Review results and handle any errors

### 4. Configure Settings

In **Settings**, configure:
- **Jira connection** details and authentication
- **Project mapping** rules and custom fields
- **Default analysis** preferences
- **Rate limiting** and retry behavior

## Architecture

### Directory Structure
```
/app
  /backend                 # Node.js + Express API
    /src
      /config             # Environment and service configuration
      /core               # Core types, errors, and utilities
      /analyzer           # Code analysis engine
        /detectors        # Language-specific parsers
        /graph            # Dependency graph builder
        /git              # Git history integration
      /models             # Mongoose data models
      /jira               # Jira API integration
      /jobs               # Background job processing
      /routes             # Express route handlers
      /controllers        # Request/response logic
      /services           # Business logic
      /middleware         # Authentication, validation, errors
      /scripts            # Utility scripts
  /frontend               # Vue 3 + Vite frontend
    /src
      /stores             # Pinia state management
      /views              # Page components
      /components         # Reusable UI components
      /router             # Vue Router configuration
  /infra                  # Docker and deployment
    docker-compose.yml    # Multi-service orchestration
    Dockerfile.backend    # Backend container
    Dockerfile.frontend   # Frontend container
```

### Data Flow

1. **Analysis Phase**:
   - File discovery and scanning
   - Language detection and parsing
   - Dependency graph construction
   - Git history extraction
   - Entity grouping and tagging

2. **Mapping Phase**:
   - Apply business rules for issue type mapping
   - Generate Jira issue structure
   - Calculate effort estimates from Git data
   - Create preview of changes

3. **Sync Phase**:
   - Batch issue creation with rate limiting
   - Set up issue relationships and links
   - Add historical worklogs
   - Execute status transitions
   - Handle errors and retries

### Key Design Decisions

- **Idempotent operations**: Uses fingerprinting to avoid duplicates
- **Git-based timelines**: Derives realistic effort from actual commit history
- **Configurable mapping**: Flexible rules for different project structures
- **Rate-limited API calls**: Respects Jira's API limits
- **Queue-based processing**: Handles long-running operations asynchronously

## API Reference

### Analysis Endpoints

```http
POST /api/analysis/run
GET  /api/analysis/:sessionId
GET  /api/analysis/:sessionId/components
GET  /api/analysis/:sessionId/modules
GET  /api/analysis/:sessionId/artifacts
DELETE /api/analysis/:sessionId
```

### Jira Endpoints

```http
POST /api/jira/preview
POST /api/jira/apply  
GET  /api/jira/jobs/:jobId
```

### Configuration Endpoints

```http
GET  /api/config/jira
POST /api/config/jira
POST /api/config/jira/test
```

## Testing

### Backend Tests
```bash
cd app/backend
npm test                # Run all tests
npm run test:watch     # Watch mode
```

### Frontend Tests  
```bash
cd app/frontend
npm test               # Run tests
npm run test:ui        # Visual test runner
```

### Integration Tests
```bash
npm run test          # Run all tests
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **GitHub Issues**: For bugs and feature requests
- **Documentation**: Check the `/docs` folder for detailed guides
- **Examples**: Sample configurations in `/examples`

## Roadmap

- [ ] **OAuth 2.0 support** for Jira authentication
- [ ] **Confluence integration** for documentation export  
- [ ] **Multiple project support** in single analysis
- [ ] **Custom issue type mapping** via UI
- [ ] **Webhook integration** for real-time updates
- [ ] **Enterprise SSO** support
- [ ] **Advanced visualizations** for dependency graphs
- [ ] **Export capabilities** (CSV, JSON, etc.)

---

**Made with ❤️ for developers who inherit legacy codebases** 
