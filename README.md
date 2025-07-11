# Anchor Escrow Program

A Solana smart contract (program) for creating and managing token escrows, built with [Anchor](https://book.anchor-lang.com/). This project demonstrates a minimal, production-ready escrow flow with full test coverage.

## Features

- Create an escrow account with custom SPL Token mints
- Deposit tokens into a vault (PDA)
- Refund and close escrow, returning tokens to the maker
- Uses SPL Token 2022 and Anchor's CPI features
- Comprehensive TypeScript test suite

## Prerequisites

- [Rust](https://www.rust-lang.org/tools/install)
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools)
- [Node.js](https://nodejs.org/) & [Yarn](https://yarnpkg.com/)
- [Anchor CLI](https://book.anchor-lang.com/getting_started/installation.html)

## Setup

1. **Clone the repo:**
   ```bash
   git clone <repo-url>
   cd anchor-escrow
   ```
2. **Install dependencies:**
   ```bash
   yarn install
   ```
3. **Build the program:**
   ```bash
   anchor build
   ```
4. **Configure Solana CLI:**
   ```bash
   solana config set --url http://127.0.0.1:8899
   solana-keygen new --no-bip39-passphrase --force --outfile ~/.config/solana/id.json
   solana airdrop 5
   ```

## Running Tests

1. **Start the local validator:**
   ```bash
   solana-test-validator --reset
   ```
2. **Deploy the program:**
   ```bash
   solana program deploy target/deploy/anchor_escrow.so --program-id target/deploy/anchor_escrow-keypair.json
   ```
3. **Run the tests:**
   ```bash
   ANCHOR_PROVIDER_URL=http://127.0.0.1:8899 ANCHOR_WALLET=~/.config/solana/id.json yarn test
   ```

## Project Structure

```
anchor-escrow/
├── programs/anchor-escrow/      # Rust smart contract
│   ├── src/
│   └── Cargo.toml
├── tests/                       # TypeScript tests
│   └── anchor-escrow.ts
├── migrations/                  # Anchor migrations
├── Anchor.toml                  # Anchor config
├── package.json                 # JS/TS dependencies
├── README.md
└── ...
```

## Key Files

- `programs/anchor-escrow/src/lib.rs` — Main program logic and instruction handlers
- `tests/anchor-escrow.ts` — MVP test suite for escrow creation, refund, and error handling

## Usage

- **Create Escrow:**
  - Call the `make` instruction with your parameters
- **Refund Escrow:**
  - Call the `refund` instruction to close and reclaim tokens

## License

MIT License
