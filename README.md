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

### `/deploy` 🚀
Deploy and manage Docker Swarm services through Portainer API.

#### `/deploy service`
- **Description**: Deploy a specific service with latest image
- **Usage**: `/deploy service endpoint:1 service:my-service-name`
- **Parameters**:
  - `endpoint`: Portainer endpoint ID
  - `service`: Name of the service to deploy
- **What it does**:
  1. Pulls the latest image with the same tag across all swarm nodes
  2. Updates the service to use the latest image version
  3. Provides detailed deployment status and node-by-node results

#### `/deploy list`
- **Description**: List all available services in an endpoint
- **Usage**: `/deploy list endpoint:1`
- **Parameters**:
  - `endpoint`: Portainer endpoint ID
- **Features**: Paginated list with service names and image tags

#### `/deploy multi`
- **Description**: Deploy multiple services interactively with optimized image pulling
- **Usage**: `/deploy multi endpoint:1`
- **Parameters**:
  - `endpoint`: Portainer endpoint ID
- **Features**: 
  - Interactive service selection menu
  - Deploy up to 25 services at once
  - **Optimized deployment**: Groups services by image and pulls each unique image only once
  - Significantly reduces deployment time when multiple services share the same image
  - Detailed results for each service with success/failure tracking

#### `/deploy status`
- **Description**: Check Portainer connection status
- **Usage**: `/deploy status`
- **Features**: Shows connected endpoints and their types

## 🐳 Portainer Integration

This bot includes a powerful Portainer integration for deploying Docker Swarm services. For detailed setup instructions, see:

📖 **[Portainer Setup Guide](PORTAINER_SETUP.md)**

Quick start:
1. Add Portainer credentials to `.env`
2. Create `whitelist_service.json` to control which services can be deployed
3. Use `/deploy status` to verify connection
4. Use `/deploy service` to deploy services

For implementation details, see [Integration Summary](INTEGRATION_SUMMARY.md).

### ⚡ Optimized Multi-Service Deployment

The bot uses an optimized deployment strategy for multiple services that significantly reduces deployment time:

**How it works:**
1. **Group by Image**: Services are grouped by their container image
2. **Pull Once**: Each unique image is pulled only once across all cluster nodes
3. **Update All**: All services using that image are updated simultaneously

**Example:**
If you deploy 10 services where 8 use `app:latest` and 2 use `worker:latest`:
- **Old behavior**: Pull `app:latest` 8 times + Pull `worker:latest` 2 times = 10 pulls
- **New behavior**: Pull `app:latest` once + Pull `worker:latest` once = 2 pulls

**Benefits:**
- ⚡ 5-10x faster deployment for services sharing images
- 📉 Reduced network bandwidth usage
- 🔄 Minimized downtime with parallel service updates
- 💾 Lower registry API load

### Whitelist Configuration

#### Service Whitelist

To control which services are available for deployment:

1. Copy the example file:
   ```bash
   cp whitelist_service.example.json whitelist_service.json
   ```

2. Edit `whitelist_service.json` and add your service names:
   ```json
   {
     "services": [
       "my-api-service",
       "my-web-service",
       "my-worker-service"
     ]
   }
   ```

3. Only services in this list will appear in the deployment menu

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
