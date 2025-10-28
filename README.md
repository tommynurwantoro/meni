# 🎯 Meni - Discord Member Engagement Bot

A powerful Discord bot built with TypeScript and Discord.js v14 to help with member engagement, community management, and server moderation.

## 🚀 Features

- **Slash Commands**: Modern Discord slash command system
- **Interactive Admin Panel**: Button-based configuration system
- **Member Welcome System**: Personalized welcome messages with configurable channels
- **Points System**: Configurable points logging and marketplace channels
- **Marketplace System**: Complete stock management with add/update/remove functionality
- **Moderation Tools**: Link protection with whitelist support
- **Portainer Integration**: Deploy Docker Swarm services directly from Discord
- **Ping Command**: Bot latency testing
- **Cooldown System**: Prevents command spam
- **Error Handling**: Robust error handling and logging
- **TypeScript**: Full TypeScript support for better development experience
- **Modular Architecture**: Clean, maintainable code structure

## 📋 Prerequisites

1. **Node.js** (v16.9.0 or higher)
2. **Discord Application** with a bot
3. **Discord Bot Token**
4. **Bot Client ID**

## 🛠️ Setup Instructions

### 1. Create Discord Application & Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Give it a name (e.g., "Meni Bot")
4. Go to "Bot" section and click "Add Bot"
5. Copy the **Bot Token** and **Client ID**

### 2. Environment Configuration

Create a `.env` file in the root directory:

```env
# Required Discord Configuration
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_bot_client_id_here

# Optional Portainer Configuration (for deployment features)
PORTAINER_URL=https://your-portainer-instance.com
PORTAINER_API_KEY=your_api_key_here

# Alternative: Use username/password instead of API key
# PORTAINER_USERNAME=your_username
# PORTAINER_PASSWORD=your_password

# AWS ECR Configuration (for automatic ECR authentication)
# Required if deploying images from AWS ECR
AWS_REGION=ap-southeast-1
AWS_ECR_REGISTRY_ID=123456789012  # Optional, your AWS account ID

# AWS Credentials (use AWS CLI configuration, environment variables, or IAM roles)
# AWS_ACCESS_KEY_ID=your_aws_access_key_here
# AWS_SECRET_ACCESS_KEY=your_aws_secret_key_here

# GitLab Configuration (for fetching tags)
# Required for /deploy tags command
GITLAB_URL=https://gitlab.com
ENCRYPTION_KEY=your-secure-encryption-key-minimum-32-characters

# Deploy Command Role Restriction (optional)
# Only users with this role ID can use deploy commands
# Leave empty to allow everyone
DEPLOY_ROLE_ID=1234567890123456789
```

**Note**: 
- For Portainer integration, you can use either an API key (recommended) or username/password authentication. If both are provided, the API key takes precedence.
- For ECR authentication, the bot will automatically fetch and refresh authentication tokens from AWS. Ensure AWS credentials are configured via AWS CLI, environment variables, or IAM roles.
- For deploy command restriction, set `DEPLOY_ROLE_ID` to restrict access to users with a specific role. Leave empty to allow all users.

### 3. Bot Permissions

Your bot needs these permissions:
- Send Messages
- Use Slash Commands
- Embed Links
- Read Message History
- View Channels
- Manage Messages (for moderation features)

### 4. Install Dependencies

```bash
npm install
```

### 5. Deploy Commands

```bash
npm run deploy
```

### 6. Start the Bot

**Development mode:**
```bash
npm run dev
```

**Production mode:**
```bash
npm run build
npm start
```

## 📚 Available Commands

### `/ping`
- **Description**: Check bot latency
- **Usage**: `/ping`
- **Cooldown**: 3 seconds

### `/configure`
- **Description**: Open the interactive configuration panel
- **Usage**: `/configure`
- **Features**: 
  - Welcome system configuration
  - Points system setup
  - Moderation settings
  - Marketplace configuration

### `/gitlab` 🔐
Manage your personal GitLab access token for authenticated API access.

#### `/gitlab token`
- **Description**: Set your GitLab personal access token (encrypted and stored securely)
- **Usage**: `/gitlab token`
- **Security**: 
  - Tokens are encrypted using AES-256-GCM encryption
  - Only you can use your token
  - Ensures proper attribution in GitLab (tags will show YOUR name as author)
- **How to create a GitLab token**:
  1. Go to GitLab → User Settings → Access Tokens
  2. Create a token with `api` scope
  3. Copy the token
  4. Use `/gitlab token` and paste it in the modal

#### `/gitlab remove`
- **Description**: Remove your stored GitLab token
- **Usage**: `/gitlab remove`

#### `/gitlab status`
- **Description**: Check if you have a GitLab token configured
- **Usage**: `/gitlab status`
- **Shows**: Configuration date and last update time

### `/deploy` 🚀
Deploy and manage Docker Swarm services through Portainer API.

#### `/deploy service`
- **Description**: Deploy a specific service using GitOps workflow
- **Usage**: `/deploy service endpoint:1`
- **Parameters**:
  - `endpoint`: Portainer endpoint ID
- **What it does**:
  1. Shows interactive menu to select a service
  2. Pre-pulls the image across all swarm nodes to cache it
  3. Updates the image tag in GitLab configuration file
  4. **GitOps handles the actual deployment automatically**
  5. Provides deployment results with:
     - Pre-pull results (node-by-node status)
     - GitLab commit information (with links)
     - Image information (name, tag, digests)
     - Note: No health monitoring needed (GitOps handles it)

**GitOps Integration:**
- The bot updates the docker-compose.yml file in your GitLab repository
- Your GitOps system (ArgoCD, Flux, etc.) picks up the changes
- Deployment happens automatically via GitOps pipeline
- Results include commit SHA and GitLab commit URL

#### `/deploy list`
- **Description**: List all available services in an endpoint
- **Usage**: `/deploy list endpoint:1`
- **Parameters**:
  - `endpoint`: Portainer endpoint ID
- **Features**: Paginated list with service names and image tags

#### `/deploy multi`
- **Description**: Deploy multiple services using GitOps workflow with optimized image pre-pulling
- **Usage**: `/deploy multi endpoint:1`
- **Parameters**:
  - `endpoint`: Portainer endpoint ID
- **Features**: 
  - Interactive service selection menu
  - Deploy up to 25 services at once
  - **Optimized pre-pulling**: Groups services by image and pulls each unique image only once
  - **Batch GitOps updates**: Updates docker-compose.yml for all services, batching by repository
  - **GitOps handles deployment**: Your GitOps system picks up the changes
  - Significantly reduces deployment time when multiple services share the same image
  - Detailed results with commit information and pre-pull status
  - Shows which repositories were updated with which services

**GitOps Benefits:**
- Single commit per repository (even for multiple services)
- Atomic updates - all services in a repo update together
- Your GitOps system handles the actual deployment
- Includes repository grouping information in results

#### `/deploy status`
- **Description**: Check Portainer connection status
- **Usage**: `/deploy status`
- **Features**: Shows connected endpoints and their types

#### `/deploy tags`
- **Description**: Get latest 3 tags for a service from GitLab
- **Usage**: `/deploy tags`
- **Prerequisites**: 
  - ⚠️ **Must set your GitLab token first** using `/gitlab token`
  - Requires GitLab URL in `.env` (GITLAB_URL)
- **Features**:
  - Interactive dropdown menu to select service from whitelist
  - Shows 3 most recent tags from GitLab
  - Displays commit information (ID, author, date, message)
  - Sorted alphabetically for easy selection
  - Shows service description in dropdown
  - Uses YOUR personal GitLab token for access

#### `/deploy create-tag`
- **Description**: Create a new tag for a service in GitLab
- **Usage**: `/deploy create-tag`
- **Prerequisites**: 
  - ⚠️ **Must set your GitLab token first** using `/gitlab token`
  - Requires GitLab URL in `.env` (GITLAB_URL)
  - Your GitLab token must have `api` scope and write permissions
- **Features**:
  - Interactive dropdown menu to select service from whitelist
  - Modal form to input tag details:
    - **Tag Name**: The name of the tag (e.g., `v1.0.0`)
    - **Tag Message**: Description/message for the tag
  - Automatically creates tag from `main` branch
  - **Tag will be created under YOUR GitLab account** (proper attribution)
  - Shows created tag details (commit ID, author, creation date)
  - **Edits the original message** to maintain history of who created the tag
  - Shows loading state during tag creation
  - Includes "Created By" field showing the Discord user who created the tag

## 🐳 Portainer Integration

This bot includes a powerful Portainer + GitOps integration for deploying Docker Swarm services. For detailed setup instructions, see:

📖 **[Portainer Setup Guide](PORTAINER_SETUP.md)**

Quick start:
1. Add Portainer credentials to `.env`
2. Create `whitelist_service.json` with GitOps configuration to control which services can be deployed
3. Use `/deploy status` to verify connection
4. Use `/deploy service` to deploy services via GitOps workflow

**GitOps Workflow Overview:**
1. **Pre-pull Images**: Bot pulls Docker images to all swarm nodes
2. **Update Config**: Bot updates docker-compose.yml files in GitLab
3. **GitOps Deployment**: Your GitOps system (ArgoCD, Flux, etc.) handles actual deployment
4. **Track Results**: Bot shows pre-pull status and GitLab commit information

For implementation details, see [Integration Summary](INTEGRATION_SUMMARY.md).

### ⚡ Optimized Multi-Service Pre-pulling with GitOps

The bot uses an optimized image pre-pulling strategy for multiple services that significantly reduces deployment time:

**How it works:**
1. **Group by Image**: Services are grouped by their container image
2. **Pre-pull Once**: Each unique image is pulled once across all cluster nodes (caching)
3. **Batch GitOps Updates**: Updates docker-compose.yml files, grouping by repository
4. **GitOps Deployment**: Your GitOps system handles the actual service updates

**Example:**
If you deploy 10 services where 8 use `app:latest` and 2 use `worker:latest`:
- **Old behavior**: Pull `app:latest` 8 times + Pull `worker:latest` 2 times = 10 pulls
- **New behavior**: Pull `app:latest` once + Pull `worker:latest` once = 2 pulls

**Benefits:**
- ⚡ 5-10x faster image pre-pulling for services sharing images
- 📉 Reduced network bandwidth usage through caching
- 🔄 GitOps handles coordinated service updates
- 💾 Lower registry API load with batch updates
- ✅ Atomic updates via GitOps (single commits per repository)

### 🔄 GitOps Deployment Integration

With GitOps integration, health monitoring is handled by your GitOps system (ArgoCD, Flux, etc.):

**Deployment Results:**
- ✅ **Pre-pull Status**: Node-by-node image caching results
- 🔄 **GitLab Commit**: Commit ID, branch, and file information
- 📦 **Image Info**: Image name, tag, digest information
- 🔗 **Commit Links**: Direct links to GitLab commits

**What You See:**
```
✅ GitOps Deployment Initiated
📦 Image: myapp:latest
└ GitLab Commit: abc12345 (main)
└ View Commit: [View in GitLab](link)
└ Image ID: abc123def456
└ Digest: sha256:...

📦 Image Pull Results
✅ Success:
--- Node 1 ---
• Digest: `sha256:abc123...`
• Image ID: `abc123def456`
--- Node 2 ---
• Digest: `sha256:def456...`
• Image ID: `def456ghi789`
```

**GitOps Benefits:**
- Your GitOps system handles health monitoring
- Rollback capabilities built into GitOps
- Audit trail through GitLab commits
- Automated deployment pipeline

### Whitelist Configuration

#### Service Whitelist with GitLab Integration

The service whitelist supports both GitLab project mapping for fetching tags and GitOps configuration for deployment:

1. Copy the example file:
   ```bash
   cp whitelist_service.example.json whitelist_service.json
   ```

2. Edit `whitelist_service.json` with your services, GitLab mappings, and GitOps configuration:
   ```json
   {
     "services": [
       "myapp-dev_api",
       "myapp-dev_web",
       "myapp-prod_api"
     ],
     "serviceMapping": {
       "myapp-dev_api": {
         "gitlabProjectId": "100",
         "description": "Main API service - Dev",
         "gitOpsRepoId": "150",
         "gitOpsFilePath": "portainer/dev/docker-compose.yml",
         "gitOpsBranch": "main",
         "serviceName": "api"
       },
       "myapp-dev_web": {
         "gitlabProjectId": "101",
         "description": "Web frontend - Dev",
         "gitOpsRepoId": "150", 
         "gitOpsFilePath": "portainer/dev/docker-compose.yml",
         "gitOpsBranch": "main"
       },
       "myapp-prod_api": {
         "gitlabProjectId": "100",
         "description": "Main API service - Prod (same repo as dev)",
         "gitOpsRepoId": "160",
         "gitOpsFilePath": "portainer/prod/docker-compose.yml", 
         "gitOpsBranch": "main"
       }
     }
   }
   ```

3. **Structure**:
   - `services`: Array of service names that can be deployed
   - `serviceMapping`: Maps each service to its GitLab project ID and GitOps configuration

4. **GitLab Integration**:
   - Each service in `serviceMapping` must have a `gitlabProjectId` to enable `/deploy tags` command
   - Project IDs can be found in GitLab project settings
   - Multiple services can share the same GitLab project ID (e.g., dev and prod environments)

5. **GitOps Configuration** (required for deployment):
   - `gitOpsRepoId`: GitLab project ID containing the docker-compose.yml file
   - `gitOpsFilePath`: Path to the docker-compose.yml file in the repository
   - `gitOpsBranch`: Branch to commit changes to (default: "main")
   - **Multiple services can share the same repository and file** (batch commits)

6. **Service Name Mapping** (for Docker Stack services):
   - `serviceName`: Actual service name in docker-compose.yml file
   - **Required when Docker service name differs from YAML service name (e.g., `tools_rain` → `rain`)**
   - **Optional**: If not provided, uses the stack service name as-is

**Benefits:**
- ✅ Control which services can be deployed
- ✅ Fetch tags directly from GitLab for each service
- ✅ Multiple services can reference the same GitLab repository
- ✅ GitOps deployment with automatic configuration updates
- ✅ Batch commits for services sharing the same GitOps repository
- ✅ Handle Docker Stack service names (e.g., `stack_service` → `service`)
- ✅ Simple and flexible configuration

**Docker Stack Service Names:**
Docker Swarm stacks create service names with the pattern `{stack}_{service}`. If your docker-compose.yml defines a service named `rain` in a stack named `tools`, Swarm creates a service called `tools_rain`. 

To deploy such services via GitOps:
- Use the stack service name (`tools_rain`) in the `services` list
- Set `serviceName` to the actual name in docker-compose.yml (`rain`)
- The bot will automatically map `tools_rain` → `rain` when updating the YAML file

**Note**: If the file is missing or empty, all services will be shown.

#### Endpoint Whitelist

To control which Portainer endpoints can be used:

1. Copy the example file:
   ```bash
   cp whitelist_endpoint.example.json whitelist_endpoint.json
   ```

2. Edit `whitelist_endpoint.json` and add your endpoint IDs:
   ```json
   {
     "endpoints": [
       1,
       2,
       3
     ]
   }
   ```

3. Only these endpoints will be accessible for deployment commands

**Note**: If the file is missing or empty, all endpoints will be allowed. Users will get an "Access Denied" error if they try to use a non-whitelisted endpoint.

## 🏗️ Project Structure

```
src/
├── commands/          # Bot commands
│   ├── ping.ts       # Ping command
│   ├── configure.ts  # Configuration command
│   └── deploy.ts     # Portainer deployment command
├── events/            # Discord events
│   ├── ready.ts      # Bot ready event
│   ├── interactionCreate.ts  # Main interaction handler
│   └── messageCreate.ts      # Message moderation
├── handlers/          # Interaction handlers
│   ├── commandHandler.ts     # Slash command handling
│   ├── buttonHandler.ts      # Button interaction routing
│   ├── modalHandler.ts       # Modal form handling
│   ├── channelSelectHandler.ts # Channel selection handling
│   ├── configButtonHandler.ts # Configuration button logic
│   ├── welcomeButtonHandler.ts # Welcome system buttons
│   ├── pointsButtonHandler.ts  # Points system buttons
│   ├── moderationButtonHandler.ts # Moderation buttons
│   └── marketplaceButtonHandler.ts # Marketplace buttons
├── views/             # UI components
│   ├── mainConfigPanel.ts    # Main configuration panel
│   ├── welcomeConfigPanel.ts # Welcome system panel
│   ├── pointConfigPanel.ts   # Points system panel
│   ├── moderationConfigPanel.ts # Moderation panel
│   ├── marketplaceConfigPanel.ts # Marketplace panel
│   ├── marketplaceStockPanel.ts  # Stock management panel
│   └── marketplaceStockModal.ts  # Stock modals
├── utils/             # Utilities
│   ├── config.ts      # Configuration management
│   ├── portainerClient.ts # Portainer API client
│   ├── database.ts    # Database connection
│   ├── redis.ts       # Redis client
│   └── scheduler.ts   # Task scheduler
├── deploy-commands.ts # Command deployment script
└── index.ts          # Main bot file
```

## ⚙️ Configuration Features

### 🎉 Welcome System
- **Configurable Channel**: Set dedicated welcome channel
- **Custom Messages**: Personalized welcome messages
- **Test Functionality**: Preview welcome messages
- **Enable/Disable**: Toggle welcome system on/off

### 💰 Points System
- **Logs Channel**: Track point transactions
- **Marketplace Channel**: Exchange points for items
- **Flexible Setup**: Configure both channels independently

### 🛡️ Moderation System
- **Link Protection**: Automatically remove unwanted links
- **Whitelist Support**: Allow specific domains
- **Moderation Logs**: Track all moderation actions
- **Configurable**: Enable/disable features as needed

### 🛒 Marketplace System
- **Stock Management**: Add, update, and remove items
- **Item Details**: Name, description, price, quantity
- **Real-time Updates**: Panel refreshes after changes
- **Persistent Storage**: All data saved automatically

### 🐳 Portainer Deployment System
- **Docker Swarm Support**: Designed for multi-node swarm clusters
- **Pre-pull Images**: Pulls images to all nodes before deployment
- **Fast Deployments**: Pre-cached images enable instant service updates
- **Multi-Service Support**: Deploy multiple services at once
- **Interactive UI**: Discord-native buttons and select menus
- **Detailed Logging**: Node-by-node status and results
- **Flexible Authentication**: API key or username/password support
- **AWS ECR Integration**: Automatic authentication token refresh for private ECR repositories

## 🔧 Development

### Adding New Commands

1. Create a new file in `src/commands/`
2. Export `data` (SlashCommandBuilder), `execute` function, and optional `cooldown`
3. The bot will automatically load it

### Adding New Events

1. Create a new file in `src/events/`
2. Export `name`, `once` (boolean), and `execute` function
3. The bot will automatically load it

### Adding New Features

1. **Create View**: Add UI component in `src/views/`
2. **Create Handler**: Add interaction logic in `src/handlers/`
3. **Update Routing**: Add button/modal routing in appropriate handlers
4. **Update Config**: Extend configuration interface if needed

### Building the Project

```bash
npm run build
```

This creates a `dist/` folder with compiled JavaScript.

## 🚨 Troubleshooting

### Bot Not Responding
- Check if the bot token is correct
- Ensure the bot has proper permissions
- Verify commands are deployed

### Commands Not Working
- Run the deploy script: `npm run deploy`
- Check bot permissions in Discord
- Ensure the bot is in the server

### Configuration Issues
- Use `/configure` to access the admin panel
- Check that all required channels are set
- Verify bot permissions in the server

### TypeScript Errors
- Run `npm run build` to check for compilation errors
- Ensure all dependencies are installed

## 📖 Learning Resources

- [Discord.js Documentation](https://discord.js.org/)
- [Discord Developer Portal](https://discord.com/developers/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## 🤝 Contributing

Feel free to contribute by:
- Adding new commands and features
- Improving the UI/UX
- Adding new moderation tools
- Enhancing the marketplace system
- Improving error handling
- Fixing bugs

## 🔮 Future Enhancements

- **User Points System**: Track individual user points
- **Advanced Moderation**: More sophisticated filtering
- **Marketplace Transactions**: User purchase system
- **Analytics Dashboard**: Server activity insights
- **Custom Commands**: User-defined commands
- **Multi-language Support**: Internationalization

## 📄 License

MIT License - feel free to use this project for your own Discord bots!

---

**Happy coding! 🎉**
