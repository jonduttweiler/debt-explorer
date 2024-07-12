import { useCallback, useEffect, useState } from "react";
import debtAbi from "../contracts/debt.abi.json";
import Web3, { AbiItem, Contract } from "web3";
import CouponsTable from "./CouponsTable";
import { useSyncProviders } from "../hooks/useSyncProviders";
const paymentToken = "USD";

interface DebtContract {
  name: () => Promise<string>;
  symbol: () => Promise<string>;
  vendor: () => Promise<string>;
  rating: () => Promise<string>;
  couponsLength: () => Promise<number>;
  coupons: (index: number) => Promise<any>;
}

const providerUrl = "https://alfajores-forno.celo-testnet.org";
const explorerUrl = "https://alfajores.celoscan.io";
const celoAlfajoresChainId = '0xaef3'; // Hexadecimal value of 44787

const isNotZeroAddress = (address: string) => {
  const zeroAddress = "0x0000000000000000000000000000000000000000";
  return Web3.utils.isAddress(address) && address.toLowerCase() !== zeroAddress.toLowerCase();
}

const shortenAddress = (address: string) => {
  if (address.length > 10) {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4, address.length)}`;
  }
  return address;
}


function Main() {
  const providers = useSyncProviders();
  const [debtAddress, setDebtAddress] = useState<string>("0xcb13dd3cdeef68fb54ab7a1ab404c92ae04c047d");
  const [loading, setLoading] = useState<boolean>(false);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [tokenName, setTokenName] = useState<string>("");
  const [tokenSymbol, setTokenSymbol] = useState<string>("");
  const [vendor, setVendor] = useState<string>("");
  const [rating, setRating] = useState<string>("");
  const [connected, setConnected] = useState<boolean>(false);/* TODO: SYNC WITH STORE */
  const [networkId, setNetworkId] = useState<string>("");
  const [accounts, setAccounts] = useState<string[]>([]);

  const [web3, setWeb3] = useState<any>(null); // State variable to hold web3 instance
  const [contract, setContract] = useState<any>(null); // State variable to hold contract instance


  const switchToCeloAlfajores = async (provider: any) => {
    try {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0xaef3', // Hexadecimal value of 44787
          chainName: 'Celo Alfajores Testnet',
          nativeCurrency: {
            name: 'CELO',
            symbol: 'CELO',
            decimals: 18
          },
          rpcUrls: ['https://alfajores-forno.celo-testnet.org'],
          blockExplorerUrls: ['https://alfajores.celoscan.io']
        }]
      });
    } catch (error) {
      console.error('Failed to switch to the network:', error);
    }
  }


  const handleConnect = async (providerWithInfo: EIP6963ProviderDetail) => {
    try {
      const accounts = await providerWithInfo.provider.request({
        method: "eth_requestAccounts"
      }) as string[];
      setAccounts(accounts);

      const networkId = await providerWithInfo.provider.request({
        method: "eth_chainId"
      }) as string;

      console.log(`Network id: ${networkId}`)
      setNetworkId(networkId);

      if (networkId != celoAlfajoresChainId) {
        await switchToCeloAlfajores(providerWithInfo.provider);
      }
      console.log(`Update web3 and contract`);
      const web3 = new Web3(providerWithInfo.provider);
      setWeb3(web3);
      setContract(new web3.eth.Contract(debtAbi, debtAddress));
      setConnected(true);



    } catch (error) {
      console.error(error);
    }
  }

  const disconnectWallet = async () => {
    setConnected(false);
    setAccounts([]);
    //ASK DISCONNECTION
  }


  const loadContract = useCallback(async () => {
    if (!debtAddress || debtAddress.length !== 42) {
      return; // Exit early if debtAddress is not valid
    }

    console.log(`Load contract at ${debtAddress}`);
    try {
      setLoading(true);
      setCoupons([]);
      const web3 = new Web3(providerUrl);
      const contract = new web3.eth.Contract(debtAbi, debtAddress);
      setContract(contract);

    } catch (error) {
      console.error('Error loading contract:', error);
      setLoading(false);
    }
  }, [debtAddress]);



  async function loadDataFromContract(contract: Contract<AbiItem[]>) {
    console.log(`Load data from contract`)
    setTokenName(await contract.methods.name().call());
    setTokenSymbol(await contract.methods.symbol().call());
    setVendor(await contract.methods.vendor().call());
    setRating(await contract.methods.rating().call());

    const couponsN = await contract.methods.couponsLength().call();

    let coupons_ = [];
    for (let i = 0; i < Number(couponsN); i++) {
      const coupon = await contract.methods.coupons(i).call();
      coupons_.push(coupon);
    }
    setCoupons(coupons_);
    setLoading(false);

  }
  useEffect(function () {
    loadContract();
  }, [loadContract]);


  useEffect(function () {
    if (contract) {
      loadDataFromContract(contract);
    }
  }, [contract]);




  return (
    <div>
      <div className="top-right">
        {connected ? (
          <div className="connected-address">
            <div>
              Network: {networkId === celoAlfajoresChainId ? 'Celo Alfajores Testnet' : 'Unknown'}
            </div>
            <div className="rw-sb">
              <div className="address-text">{shortenAddress(accounts[0])}</div>
              <button className="disconnect-wallet-button" onClick={disconnectWallet}>Disconnect</button>

            </div>
          </div>
        ) : (
          providers.length > 1 ? (
            <div className="dropdown">
              <button className="connect-wallet-button">Connect wallet</button>
              <div className="dropdown-content">
                {providers.map((provider: EIP6963ProviderDetail) => (
                  <button key={provider.info.uuid} onClick={() => handleConnect(provider)}>
                    Connect with {provider.info.name}
                  </button>
                ))}
              </div>
            </div>
          ) : providers.length === 1 ? (
            <button className="connect-wallet-button" onClick={() => handleConnect(providers[0])}>
              Connect with {providers[0].info.name}
            </button>
          ) : <></>

        )}


      </div>
      <div>
        Network: Celo Alfajores
      </div>
      <div className="m1" >
        <input
          className="eth-address-input"
          type="text"
          placeholder="Debt address"
          value={debtAddress}
          onChange={(e) => setDebtAddress(e.target.value)}
        />
      </div>

      <div>
        <div className="m1">
          <a className="link" rel="noreferrer" target="_blank" href={`${explorerUrl}/address/${debtAddress}`}>
            {tokenSymbol && (
              <span>
                Token: {tokenName} ({tokenSymbol})
              </span>
            )}
          </a>
        </div>
        {(isNotZeroAddress(vendor)) && `${vendor}`}
        {"Rating: " + rating ? rating : ""}
      </div>

      {contract != null && (
        <button onClick={async () => {
          try {
            const result = await contract.methods.updateCouponRate(0, BigInt(7 * 10 ** 16)) //7%
              .send({
                from: accounts[0],
                gas: 500000 
              })
            console.log(result);
          } catch (err) {
            console.log(err);
          }

        }}>Send demo transaction</button>
      )}

      {
        loading ? (
          <div className="spinner-container">
            <div className="spinner"></div>
          </div>
        ) : <CouponsTable
          coupons={coupons}
          paymentToken={paymentToken}
        />
      }

    </div>
  )
}
export default Main;