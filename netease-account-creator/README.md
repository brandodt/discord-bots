# NetEase Account Creator Discord Bot

A Discord bot that automates the creation of NetEase accounts with features for batch creation and management.

## Features

- Create single NetEase accounts with email verification
- Batch create multiple accounts (up to 5 at once)
- Gmail alias support for multiple accounts
- Automatic username generation
- Secure password generation
- Account verification system
- List created accounts

## Prerequisites

- Node.js (v16 or higher)
- Discord Bot Token
- Discord Application/Bot setup in Discord Developer Portal

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```
3. Copy `.env.example` to `.env` and fill in your Discord bot credentials:
   - APPLICATION_ID
   - CLIENT_SECRET
   - PUBLIC_KEY
   - CLIENT_ID
   - GUILD_ID
   - DISCORD_TOKEN
   - ACCOUNTS_FILE (defaults to ./accounts.txt)

## Available Commands

- `/create` - Create a single NetEase account
- `/batch` - Create multiple accounts (1-5) using a base email
- `/list` - View all created accounts
- `/verify` - Verify an account with email verification code

## Bot Commands Usage

### Single Account Creation
```
/create email:[your-email]
```

### Batch Account Creation
```
/batch email:[base-email] count:[1-5]
```

### List Accounts
```
/list
```

### Verify Account
```
/verify code:[verification-code]
```

## Security Notes

- All sensitive information is stored securely
- Email verification is required for account creation
- Passwords are generated following security best practices

## Dependencies

- discord.js
- axios
- dotenv
- crypto
- md5

## License

ISC