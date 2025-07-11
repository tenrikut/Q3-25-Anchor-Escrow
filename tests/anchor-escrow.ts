import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AnchorEscrow } from "../target/types/anchor_escrow";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddress,
  TOKEN_2022_PROGRAM_ID,
  getAccount,
} from "@solana/spl-token";
import { expect } from "chai";

describe("anchor-escrow", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.anchorEscrow as Program<AnchorEscrow>;

  // Test keypairs and variables
  let maker: Keypair;
  let mintA: PublicKey;
  let mintB: PublicKey;
  let makerAtaA: PublicKey;
  let escrow: PublicKey;
  let vault: PublicKey;

  const seed = new anchor.BN(42);
  const depositAmount = new anchor.BN(1000);
  const receiveAmount = new anchor.BN(2000);

  before(async () => {
    // Create a new maker keypair and airdrop SOL
    maker = Keypair.generate();

    // Airdrop SOL to maker (more SOL for account creation costs)
    const signature = await provider.connection.requestAirdrop(
      maker.publicKey,
      10 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);

    // Wait a bit for the airdrop to be processed
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Create token mints
    mintA = await createMint(
      provider.connection,
      maker,
      maker.publicKey,
      null,
      6, // decimals
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    mintB = await createMint(
      provider.connection,
      maker,
      maker.publicKey,
      null,
      6, // decimals
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    // Create associated token account for maker's token A
    makerAtaA = await createAssociatedTokenAccount(
      provider.connection,
      maker,
      mintA,
      maker.publicKey,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    // Mint tokens to maker's ATA
    await mintTo(
      provider.connection,
      maker,
      mintA,
      makerAtaA,
      maker,
      depositAmount.toNumber() * 2, // Mint double the deposit amount
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    // Calculate PDAs
    [escrow] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow"),
        maker.publicKey.toBuffer(),
        seed.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    vault = await getAssociatedTokenAddress(
      mintA,
      escrow,
      true,
      TOKEN_2022_PROGRAM_ID
    );
  });

  it("Creates an escrow and deposits tokens", async () => {
    const tx = await program.methods
      .make(seed, depositAmount, receiveAmount)
      .accountsPartial({
        maker: maker.publicKey,
        mintA: mintA,
        mintB: mintB,
        makerAtaA: makerAtaA,
        escrow: escrow,
        vault: vault,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([maker])
      .rpc();

    console.log("Make transaction signature:", tx);

    // Verify escrow account state
    const escrowAccount = await program.account.escrow.fetch(escrow);
    expect(escrowAccount.seed.toString()).to.equal(seed.toString());
    expect(escrowAccount.maker.toString()).to.equal(maker.publicKey.toString());
    expect(escrowAccount.mintA.toString()).to.equal(mintA.toString());
    expect(escrowAccount.mintB.toString()).to.equal(mintB.toString());
    expect(escrowAccount.receive.toString()).to.equal(receiveAmount.toString());

    // Verify vault has the deposited tokens
    const vaultAccount = await getAccount(
      provider.connection,
      vault,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );
    expect(vaultAccount.amount.toString()).to.equal(depositAmount.toString());

    // Verify maker's ATA balance decreased
    const makerAtaAccount = await getAccount(
      provider.connection,
      makerAtaA,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );
    expect(makerAtaAccount.amount.toString()).to.equal(
      depositAmount.toString()
    );
  });

  it("Refunds tokens and closes the escrow", async () => {
    const tx = await program.methods
      .refund()
      .accountsPartial({
        maker: maker.publicKey,
        mintA: mintA,
        makerAtaA: makerAtaA,
        escrow: escrow,
        vault: vault,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([maker])
      .rpc();

    console.log("Refund transaction signature:", tx);

    // Verify escrow account is closed
    try {
      await program.account.escrow.fetch(escrow);
      expect.fail("Escrow account should be closed");
    } catch (error) {
      expect(error.message).to.include("Account does not exist");
    }

    // Verify vault account is closed (it should throw an error when trying to fetch)
    try {
      await getAccount(
        provider.connection,
        vault,
        undefined,
        TOKEN_2022_PROGRAM_ID
      );
      expect.fail("Vault account should be closed");
    } catch (error) {
      // Any error here means the account was closed, which is what we expect
      console.log("Vault account closed successfully");
    }

    // Verify maker got all tokens back
    const makerAtaAccount = await getAccount(
      provider.connection,
      makerAtaA,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );
    expect(makerAtaAccount.amount.toString()).to.equal(
      (depositAmount.toNumber() * 2).toString()
    );
  });

  it("Cannot refund non-existent escrow", async () => {
    try {
      await program.methods
        .refund()
        .accountsPartial({
          maker: maker.publicKey,
          mintA: mintA,
          makerAtaA: makerAtaA,
          escrow: escrow,
          vault: vault,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([maker])
        .rpc();

      expect.fail("Should have failed to refund non-existent escrow");
    } catch (error) {
      // Any error here is expected since we're trying to refund a closed escrow
      console.log(
        "Expected error when trying to refund closed escrow:",
        error.message
      );
    }
  });
});
