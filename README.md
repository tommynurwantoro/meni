# 🎯 Meni - Discord Member Engagement Bot

A powerful Discord bot built with TypeScript and Discord.js v14 to help with member engagement, community management, and server moderation.

## 🚀 Features

- **Slash Commands**: Modern Discord slash command system
- **Interactive Admin Panel**: Button-based configuration system
- **Member Welcome System**: Personalized welcome messages with configurable channels
- **Points System**: Configurable points logging and marketplace channels
- **Marketplace System**: Complete stock management with add/update/remove functionality
- **Moderation Tools**: Link protection with whitelist support
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
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_bot_client_id_here
```

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

## 🏗️ Project Structure

```
src/
├── commands/          # Bot commands
│   ├── ping.ts       # Ping command
│   └── configure.ts  # Configuration command
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
│   └── config.ts      # Configuration management
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
