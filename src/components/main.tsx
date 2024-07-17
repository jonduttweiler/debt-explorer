import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from 'react-router-dom';
import debtAbi from "../contracts/debt.abi.json";
import Web3, { AbiItem, Contract, TransactionRevertedWithoutReasonError } from "web3";
import CouponsTable from "./CouponsTable";
import { useSyncProviders } from "../hooks/useSyncProviders";
const paymentToken = "USD";

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


interface Debt {
  name: string;
  symbol: string;
  rating?: string;
  vendor: string; /* This should be an address */
  coupons: any[];
  minRate: string
}


//0xcb13dd3cdeef68fb54ab7a1ab404c92ae04c047d
//0x2b3a9258145d736d93dd2e501e11fa24c7a87ee0
//0x4c2f335fc5289be901e358755f029a655b984e25 //new abi
//0x95f92dE0EE45CD978E10D44c68fE893bAF2Cfb07//new abi


function Main() {
  const providers = useSyncProviders();
  const { address } = useParams();
  
  const [debtAddress, setDebtAddress] = useState<string>(address || "0x95f92dE0EE45CD978E10D44c68fE893bAF2Cfb07");
  const [loading, setLoading] = useState<boolean>(false);
  
  const [debt, setDebt] = useState<Debt>(); 

  const [connected, setConnected] = useState<boolean>(false);/* TODO: SYNC WITH STORE */
  const [networkId, setNetworkId] = useState<string>("");
  const [accounts, setAccounts] = useState<string[]>([]);

  const cIndexRef = useRef<HTMLInputElement>(null);
  const rateRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line
  const [_web3, setWeb3] = useState<any>(null); // State variable to hold web3 instance
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

      if (networkId !== celoAlfajoresChainId) {
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
      const web3 = new Web3(providerUrl);
      const contract = new web3.eth.Contract(debtAbi, debtAddress);
      setContract(contract);

    } catch (error) {
      console.error('Error loading contract:', error);
      setLoading(false);
    }
  }, [debtAddress]);



  /* This function receives a contract as params, and then set some state 
    getting the min rate, name, symbol, and other
  */
  async function loadDataFromContract(contract: Contract<AbiItem[]>) {
    console.log(`Load data from contract`)
    
    let minRate : bigint = await contract.methods.annualMinRate().call();
    let etherValue = Web3.utils.fromWei(minRate.toString(), 'ether');
    let formattedMinRate = `${Number(etherValue) *100} % `;
    
    
    const couponsN = await contract.methods.couponsLength().call();
    
    let coupons_ = [];
    for (let i = 0; i < Number(couponsN); i++) {
      const coupon = await contract.methods.coupons(i).call();
      coupons_.push(coupon);
    }

    

    setLoading(false);


    setDebt({
      name: await contract.methods.name().call(),
      symbol: await contract.methods.symbol().call(),
      vendor: await contract.methods.vendor().call(),
      rating: await contract.methods.rating().call(),
      minRate: formattedMinRate,
      coupons: coupons_
    });
  }


  async function updateCoupon(couponIndex: number) {
    const updated = await contract.methods.coupons(couponIndex).call();

    setDebt((prevDebt) => {
      if (!prevDebt) {
        return prevDebt; 
      }
      return {
        ...prevDebt,
        coupons: prevDebt.coupons.map((coupon, index) => index === couponIndex ? updated : coupon)
      };
    });
  };

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
        {debt && debt.name && (
          <div className="m1">
            <>
              Token:
              <a className="link" rel="noreferrer" target="_blank" href={`${explorerUrl}/address/${debtAddress}`}>
                <span>
                  {debt.name} ({debt.symbol})
                </span>
              </a>
            </>
          </div>
        )}
        {debt && (isNotZeroAddress(debt.vendor)) && (
          <span>
            Vendor:
            <a className="link" rel="noreferrer" target="_blank" href={`${explorerUrl}/address/${debt.vendor}`}>{debt.vendor}</a>
          </span>
        )}

        {debt && debt.rating && "Rating: " + debt!.rating}
      </div>
      {debt && debt.minRate.length >0 && (
        <div>
          Annual Min Rate: {debt?.minRate}
        </div>
      )}
      



      {/*       <div>
        Check roles
        <button onClick={async () => {
          try {
            if (contract) {
              console.log(`Checking role BOND_ADMIN_ROLE for ${accounts[0]}`)
              const result = await contract.methods.hasRole(web3.utils.soliditySha3("BOND_ADMIN_ROLE"), accounts[0]).call(); //false
              console.log(result)
            }

          } catch (err) {
            console.log(err);
          }
        }

        }>Check role</button>

      </div>
 */}
      {/* Move to a dedicated component */}
      {contract != null && accounts[0] != null && (
        <div>

          <input type="text" ref={cIndexRef} placeholder="coupon index" />
          <input type="text" ref={rateRef} placeholder="rate %" />


          <button onClick={async () => {
            try {
              if (cIndexRef.current && rateRef.current) {
                const couponIndex = parseInt(cIndexRef.current.value, 10);
                if (debt?.coupons != null && couponIndex >= debt.coupons.length) {
                  throw new Error("Coupon index out of bounds");
                }

                const rateValue = Number(rateRef.current.value);
                const rate = BigInt(rateValue * 10 ** 16);
                const result = await contract.methods.updateCouponRate(couponIndex, rate)
                  .send({
                    from: accounts[0], /* Get the account of fmk admin for deployed , another option will be to use a account as current or detect changes on the wallet*/
                    gas: 500000
                  })
                  .on('confirmation', async function (confirmationNumber: any, receipt: any) {
                    console.log(`confirmed`);
                    console.log(confirmationNumber);
                    console.log(receipt);
                    await updateCoupon(couponIndex);

                  })
                console.log(result);

              }
            } catch (err) {
              console.log(err);
              if (err instanceof TransactionRevertedWithoutReasonError) {
                console.log(err);

              }


            }

          }}>Send demo transaction (updateCouponRate)</button>
        </div>
      )}

      {
        loading ? (
          <div className="spinner-container">
            <div className="spinner"></div>
          </div>
        ) : debt? <CouponsTable
          coupons={debt.coupons}
          paymentToken={paymentToken}
        />: <></>
      }

    </div>
  )
}
export default Main;