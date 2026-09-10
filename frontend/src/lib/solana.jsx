import React, { useMemo } from 'react';
import { ConnectionProvider, WalletProvider, useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import '@solana/wallet-adapter-react-ui/styles.css';

export const SolanaProviders = ({ children }) => {
  const endpoint = process.env.REACT_APP_SOLANA_RPC_URL;
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);
  return (
    <ConnectionProvider endpoint={endpoint} config={{ commitment: 'confirmed' }}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export const useSolTransfer = () => {
  const { publicKey, connected, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const transfer = async (to, amountSol) => {
    if (!publicKey) throw new Error('Connect a wallet first');
    const lamports = Math.round(Number(amountSol) * LAMPORTS_PER_SOL);
    if (!(lamports > 0)) throw new Error('Enter a positive SOL amount');
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    const tx = new Transaction({ feePayer: publicKey, blockhash, lastValidBlockHeight })
      .add(SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: new PublicKey(to), lamports }));
    const signature = await sendTransaction(tx, connection);
    await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
    return signature;
  };
  return { transfer, connected, publicKey, address: publicKey?.toBase58() || '' };
};
