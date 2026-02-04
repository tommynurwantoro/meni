# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Meni** is a Discord bot built with TypeScript and Discord.js v14 for member engagement, community management, and server automation. It operates in multiple Discord servers and includes marketplace systems, points tracking, prayer reminders, and Docker deployment management via Portainer.

## Development Commands

```bash
npm run dev              # Development with hot-reload (tsx watch)
npm run build            # Production build with tsup (minified)
npm run start            # Run production build (node dist/index.js)
npm run deploy           # Build and deploy Discord slash commands
```

**Important**: After adding or modifying slash commands in `src/commands/`, run `npm run deploy` to register them with Discord. This script builds the commands directory, builds the deploy script, and calls the Discord REST API to update commands.

## Docker Deployment

```bash
docker-compose up -d     # Start all services (bot, postgres, redis)
docker-compose down      # Stop all services
```

The bot is deployed via Docker Compose with three services:
- **bot**: Main application with Docker socket mounted for image pulling
- **postgres**: PostgreSQL database with health check
- **redis**: Redis cache with persistence enabled

## Architecture Overview

### Event-Driven Command Pattern

The bot follows Discord.js v14's event-driven architecture:

1. **Entry Point**: `src/index.ts` initializes the client, loads modules, connects to services
2. **Events** (`src/events/`): Discord event handlers (ready, interactionCreate, guildMemberAdd, messageCreate)
3. **Commands** (`src/commands/`): Slash command implementations with subcommands
4. **Handlers** (`src/handlers/`): Dedicated interaction type handlers (buttons, modals, selects)
5. **Views** (`src/views/`): UI components using Discord's Action Row and Embed system

### Interaction Flow

```
User Input → Discord API →
├── Slash Command → commandHandler → Command Execution
├── Button Interaction → buttonHandler → Feature Logic
├── Modal Submission → modalHandler → Form Processing
└── Select Menus → stringSelectHandler → Selection Handling
```

The main event router is in `src/events/interactionCreate.ts` which delegates to specialized handlers.

### Command Structure

Commands are organized as Slash Commands. Complex commands use subcommands:

**Simple commands**: Single file in `src/commands/` (e.g., `ping.ts`, `reminder.ts`)

**Complex commands**: Subdirectory with shared utilities
```
src/commands/deploy/
├── index.ts          # Main command entry point with SlashCommandBuilder
├── handleListEndpoints.ts
├── handleCreateTag.ts
├── handleSwitchTag.ts
├── handleApplyStack.ts
└── utils.ts          # Shared utilities
```

### Configuration System

Multi-layer configuration approach:

1. **Environment Variables** (`.env`): Sensitive data (tokens, API keys, database URLs)
2. **Guild Config** (`config.json`): Per-guild settings (channels, roles, feature toggles)
3. **Runtime Configuration**: Interactive admin panels via `/configure` command

The config system is managed by `src/utils/config.ts` which provides functions like `getConfig(guildId)`, `setConfig(guildId, updates)`, and `resetConfig(guildId)`.

### Database Schema

PostgreSQL with Sequelize ORM. Models are in `src/models/`:

- **PointsUser**: User points and achievement tracking
- **PointsTransaction**: All point transfer records
- **Review**: User review data storage
- **GitLabToken**: Encrypted personal access tokens

Database connection is in `src/utils/database.ts`. Models are synced automatically on startup with `alter: true` strategy.

### Key Features

**Points Economy** (`src/utils/pointsUtils.ts`):
- Point tracking per user
- Transaction logging
- Achievement system with role-based rewards
- Thanks command for transferring points

**Marketplace** (`src/utils/marketplaceUtils.ts`):
- Stock management (add/update/remove items)
- Points-based purchasing
- Channel configuration for listings

**Deployment System** (`src/commands/deploy/`):
- Portainer API integration for Docker Swarm
- GitLab API integration for gitops (updating docker-compose.yml)
- AWS ECR authentication for private registries
- Whitelist system for service/endpoint restrictions
- Pre-pull images across swarm nodes before deployment

**Reminder System** (`src/utils/reminderUtils.ts`):
- Personal reminders with cron scheduling
- System reminders (presensi/clock-in, prayer times)
- DM support for notifications

### External Integrations

- **Portainer**: `src/utils/portainerClient.ts` - Docker Swarm management
- **GitLab**: `src/utils/gitlabClient.ts` - Repository operations
- **AWS ECR**: Built into portainerClient for private registry auth
- **N8N**: `src/utils/n8nWebhook.ts` - Webhook notifications
- **Attendance API**: `src/utils/presensiUtils.ts` - Clock-in/clock-out tracking

### Scheduler System

`src/utils/scheduler.ts` manages cron jobs using node-cron:
- Morning/Evening presensi reminders: 07:55 & 17:05 (Mon-Fri)
- Prayer schedule updates: 00:01 daily
- Prayer/reminder checks: Every minute
- Attendance checks: Configurable times

Scheduler is initialized after Discord client is ready.

### Security Considerations

- GitLab tokens are encrypted using AES-256-GCM (`src/utils/encryption.ts`)
- Role-based permissions for deployment commands (DEPLOY_ROLE_ID)
- Input validation on all user interactions
- Non-root Docker user for production

## File Structure

```
src/
├── commands/          # Slash command implementations
│   └── deploy/        # Complex command with subcommands
├── events/           # Discord event handlers (ready, interactionCreate, etc.)
├── handlers/         # Interaction type handlers (buttons, modals, selects)
├── views/            # UI panels and configuration interfaces
├── utils/            # Feature-specific utilities and service clients
├── models/           # Sequelize database models
└── index.ts          # Main entry point
```

## Adding New Features

1. **New Slash Command**: Create in `src/commands/`, then run `npm run deploy`
2. **New Handler**: Add to `src/handlers/` (buttons/, modals/, selects/) and register in `src/events/interactionCreate.ts`
3. **New Database Model**: Add to `src/models/` and import in `src/models/index.ts`
4. **New Utility Module**: Add to `src/utils/` and import where needed

## Important Notes

- The bot uses CommonJS modules (`"type": "commonjs"` in package.json)
- TypeScript target is ES2020
- Redis is optional - bot continues without it if connection fails
- Portainer integration is optional - deployment features disabled if not configured
- Timezone is Asia/Jakarta by default (configurable via TZ env var)
- Graceful shutdown handlers for SIGINT/SIGTERM properly close Redis connection
