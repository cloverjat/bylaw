// WalletConnect, loaded on demand as dist/wc.js so the main page stays small.
import { EthereumProvider } from '@walletconnect/ethereum-provider';

window.__bylawWC = async function (projectId, rpcUrl) {
  const provider = await EthereumProvider.init({
    projectId,
    optionalChains: [196],
    rpcMap: { 196: rpcUrl },
    showQrModal: true,
    metadata: { name: 'Bylaw', description: 'Rules your money can\'t break.', url: location.origin, icons: [] },
  });
  if (!provider.session) await provider.connect();
  else await provider.enable();
  return provider;
};
