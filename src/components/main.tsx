import { useEffect, useRef, useState } from "react";
import { useParams } from 'react-router-dom';
import tokenAbi from "../contracts/erc20.abi.json";
import debtAbi from "../contracts/debt.abi.json";
import vendorAbi from "../contracts/vendor.abi.json";
//import Web3, { AbiItem, Contract, TransactionRevertedWithoutReasonError } from "web3";
import CouponsTable from "./CouponsTable";
import { createWeb3Modal, defaultConfig, useDisconnect, useWeb3ModalAccount, useWeb3ModalProvider } from '@web3modal/ethers/react'
import { useWeb3Modal } from '@web3modal/ethers/react'
import { BrowserProvider, Contract, formatEther, JsonRpcProvider, JsonRpcSigner, keccak256, toUtf8Bytes, TransactionResponse } from "ethers";
import toast from 'react-hot-toast';
import { handleTransactionError, showLoadingToast, showPendingTransactionToast, showTransactionConfirmedToast } from "../toast-utils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCopy } from "@fortawesome/free-solid-svg-icons";
import Skeleton from "./utils/Skeleton";
import PaymentHistory from "./PaymentHistory";
import { isNotZeroAddress, shortenAddress } from "../utils";


const projectId = "7cc5f0113eb20ca7c4c7cbf31acfc131";

export const alfajores = {
  chainId: 44787,
  name: 'Celo Alfajores Testnet',
  currency: 'CELO',
  explorerUrl: 'https://alfajores.celoscan.io',
  rpcUrl: 'https://alfajores-forno.celo-testnet.org'
}

const metadata = {
  name: 'Forestmaker Debt explorer',
  description: 'Forestmaker Debt explorer',
  url: 'http://localhost:3000/', //'https://forestmaker-debt-explorer.netlify.app', //but could be localhost too
  icons: ['https://web.forestmaker.org/assets/images/favicon.png']
}

const network = alfajores;

// 4. Create Ethers config
const ethersConfig = defaultConfig({
  metadata
})


createWeb3Modal({
  ethersConfig,
  chains: [alfajores],
  projectId,
  enableAnalytics: true // Optional - defaults to your Cloud configuration
})

const VALIDATOR_ROLE = keccak256(toUtf8Bytes("VALIDATOR_ROLE"));
const BOND_ADMIN_ROLE = keccak256(toUtf8Bytes("BOND_ADMIN_ROLE"));
const BOND_DEPOSIT_ROLE = keccak256(toUtf8Bytes("BOND_DEPOSIT_ROLE"));

function Main() {
  const { address: debtAddressParam } = useParams();
  const { open } = useWeb3Modal();
  const { disconnect } = useDisconnect();
  const { address, isConnected } = useWeb3ModalAccount();
  const { walletProvider } = useWeb3ModalProvider();
  const [signer, setSigner] = useState<JsonRpcSigner | null>();
  const [debtAddress, setDebtAddress] = useState<string>(debtAddressParam || "0xceb83c062ae396fa398596650688bf8c61467258");
  const [loading, setLoading] = useState<boolean>(false);
  const [debt, setDebt] = useState<Debt>();
  const [circulatingSupply, setCirculatingSupply] = useState<string>();
  const [updatingAvailableInterest, setUpdatingAvailableInterest] = useState<boolean>(false);
  const [availableInterests, setAvailableInterests] = useState<string>();

  const [debtContract, setDebtContract] = useState<Contract>();
  const [vendorContract, setVendorContract] = useState<Contract>();
  const [paymentToken, setPaymentToken] = useState<Contract>();
  const [paymentSymbol, setPaymentSymbol] = useState<string | undefined>();
  const hasRunOnce = useRef(false);
  const [roles, setRoles] = useState<string[]>([]); /* Should be a set */
  const [syncCounter, setSyncCounter] = useState<number>(0);


  const cIndexRef = useRef<HTMLInputElement>(null);
  const rateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!debtAddress) return;
    if (isConnected) {
      loadDataFromContractWithSigner();
    } else {
      loadDataFromContractWithProvider();

    }
  }, [isConnected, debtAddress])


  async function loadDataFromContractWithProvider() {
    let provider = new JsonRpcProvider(network.rpcUrl);
    const debtContract = new Contract(debtAddress, debtAbi, provider);
    setSigner(null);
    loadDataFromContract(debtContract);
    setDebtContract(debtContract);

    const paymentAddr = await debtContract.paymentToken();
    const paymentToken = new Contract(paymentAddr, tokenAbi, provider);
    setPaymentToken(paymentToken);
  }

  async function loadDataFromContractWithSigner() {
    const ethersProvider = new BrowserProvider(walletProvider!);
    const signer = await ethersProvider.getSigner();
    setSigner(signer);
    const debtContract = new Contract(debtAddress, debtAbi, signer);
    loadDataFromContract(debtContract);
    setDebtContract(debtContract);
    loadRolesFromSmartContract(debtContract, signer.address);
    getPastEvents(debtContract);

    const paymentAddr = await debtContract.paymentToken();
    const paymentToken = new Contract(paymentAddr, tokenAbi, signer);
    setPaymentToken(paymentToken);
  }

  async function getPastEvents(contract: Contract) { /* We can filter or not by address */
    const filter = contract.filters.CouponPaid();
    const fromBlock = 0;
    const toBlock = "latest";

    const events = await contract.queryFilter(filter, fromBlock, toBlock);

    const paids: Paid[] = (await Promise.all(events.map(async event => {
      if ("args" in event) {
        const { couponIndex, who, tokenAmount } = event.args;
        const paid: Paid = {
          tx: event.transactionHash,
          when: (await event.getBlock()).timestamp * 1000,
          who: who,
          couponIndex: couponIndex,
          amount: tokenAmount
        };
        return paid;
      }
    }))).filter(paid => paid != undefined);


    console.log(paids);
  }

  async function loadRolesFromSmartContract(debtContract: Contract, who: string) {

    let roles: string[] = [];

    if (await debtContract.hasRole(BOND_ADMIN_ROLE, who)) {
      roles.push("BOND ADMIN ROLE");
    }
    if (await debtContract.hasRole(VALIDATOR_ROLE, who)) {
      roles.push("VALIDATOR ROLE");
    }
    if (await debtContract.hasRole(BOND_DEPOSIT_ROLE, who)) {
      roles.push("BOND DEPOSIT ROLE");
    }
    setRoles(roles);
  }


  function clearDebt() {
    setDebt({
      name: "",
      symbol: "",
      vendor: "",
      rating: "",
      coupons: [],
    });
  }

  async function loadDataFromContract(contract: Contract) {
    console.log(`Load data from contract`)
    clearDebt();
    setLoading(true);

    try {

      const couponsN = await contract.couponsLength();
      const ethValue = formatEther(await contract.annualMinRate());

      setDebt({
        name: await contract.name(),
        symbol: await contract.symbol(),
        vendor: await contract.vendor(),
        rating: await contract.rating(),
        minRate: `${Number(ethValue) * 100} %`,
        coupons: []
      });

      let coupons_ = [];
      for (let i = 0; i < Number(couponsN); i++) {
        const coupon = await contract.coupons(i);
        coupons_.push(coupon);
      }
      setDebt({
        name: await contract.name(),
        symbol: await contract.symbol(),
        vendor: await contract.vendor(),
        rating: await contract.rating(),
        minRate: `${Number(ethValue) * 100} %`,
        coupons: coupons_
      });

      setLoading(false);
    } catch (err) {
      console.log(err);
    }
    setLoading(false);
  }

  async function updateCoupon(index: number) {
    if (!debtContract || !debt) return;

    const updated = await debtContract.coupons(index);

    setDebt(debt => ({
      ...debt!,
      coupons: debt!.coupons.map((coupon, index_) => index_ === index ? updated : coupon)
    }))

  }



  async function sendTransaction() {  /* Move to a dedicated component */

    if (!debtContract) return;
    if (cIndexRef.current && rateRef.current) {

      const couponIndex = parseInt(cIndexRef.current.value, 10);
      if (isNaN(couponIndex) || couponIndex < 1) {
        toast.error("Invalid coupon index. Please enter a valid positive integer greater than 0.");
        return;
      }

      const rateValue = parseFloat(rateRef.current.value);
      if (isNaN(rateValue) || rateValue <= 0) {
        toast.error("Rate must be a positive number");
        return;
      }

      const rate = BigInt(rateValue * 10 ** 16);
      let toastId;


      try {
        toastId = showLoadingToast(couponIndex, rate);
        const result: TransactionResponse = await debtContract.updateCouponRate(couponIndex - 1, rate);

        let txHash = result.hash;

        if (txHash) {
          showPendingTransactionToast(txHash, toastId);
        }

        let confirmation = await result.wait(3);
        if (confirmation != null) {
          showTransactionConfirmedToast(txHash, toastId);
        }

        console.log(result.hash)

        /* Update coupon with index */

        updateCoupon(couponIndex - 1);


      } catch (err) {
        toastId && handleTransactionError(err, toastId);
      }
    }
  }


  useEffect(() => {
    if (debt && debt.vendor && isNotZeroAddress(debt.vendor)) {
      let provider = new JsonRpcProvider(network.rpcUrl);
      const vendorContract = new Contract(debt.vendor, vendorAbi, provider);
      setVendorContract(vendorContract);
    };
  }, [debt])


  async function listenToVendor(vendorContract: Contract) {
    console.log(`Vendor contract initialized, check events`);

    const listenerCount = await vendorContract.listenerCount("Sell");
    console.log(`Listener counts: ${listenerCount}`)

    if (listenerCount == 0) {
      vendorContract.removeAllListeners();
      vendorContract.on("Sell", (who, qty, event) => { //TODO: TAMBIEN ESCUCHAR AL BUYBACK
        console.log(`Sell event detected:`);
        console.log(`  Who: ${who}`);
        console.log(`  Quantity: ${qty.toString()}`);
        console.log(`  Block number: ${event.blockNumber}`);
        console.log(`  Transaction hash: ${event.transactionHash}`);

        //Update circulating supply
        updateCirculatingSupply(true);
      });

      console.log(`Events listener to vendor registered`)
    }
  }

  useEffect(() => {
    if (vendorContract && !hasRunOnce.current) {
      listenToVendor(vendorContract);
      hasRunOnce.current = true; // Mark as run
    }
  }, [vendorContract]);

  async function updateCirculatingSupply(notify: boolean = false) {
    const circulating = await debtContract!.getCirculatingSupply();
    setCirculatingSupply(circulating.toString());

    if (notify) {
      toast('Circulating supply updated', {
        icon: 'ⓘ',
      });
    }
  }
  async function updateAvailableInterests() {
    if (!paymentToken || !debtContract) return;
    setUpdatingAvailableInterest(true);
    try {
      const paymentBalance = await paymentToken.balanceOf(debtContract.target);
      const symbol = await paymentToken.symbol();
      setUpdatingAvailableInterest(false);
      setAvailableInterests(`${Number(formatEther(paymentBalance)).toFixed(3)} ${symbol}`);
      setPaymentSymbol(symbol);
    } catch (err) {
      console.log(err);
      setUpdatingAvailableInterest(false);
    }


  }



  useEffect(() => {
    if (!debtContract) return;
    updateCirculatingSupply();
    updateAvailableInterests();
  }, [debtContract])

  const copyToClipboard = () => {
    if (!address) return;
    navigator.clipboard.writeText(address).then(() => {
      toast.success('Address copied to clipboard');

    }).catch(err => {
      toast.error('Address copied to clipboard');
      console.error('Could not copy text: ', err);
    });
  };


  return (
    <div>
      <div className="top-right">
        {!isConnected ? (
          <button onClick={() => open()} className="connect-wallet-button">Connect wallet</button>
        ) : (
          <div className="current-account">
            <div>
              {shortenAddress(address!)}

              <button onClick={copyToClipboard} className="copy-button">
                <FontAwesomeIcon icon={faCopy} />
              </button>
            </div>

            <div className="roles-container">
              {roles.map(role => (
                <div key={role}>{role}</div>
              ))}
            </div>
            <div>
              {roles.length === 0 && `No roles detected`}
            </div>
            <div>
              <button onClick={() => disconnect()} className="disconnect-wallet-button">Disconnect</button>
            </div>
          </div>
        )}
      </div>
      <div>
        Network: Celo Alfajores
      </div>
      <div className="m1" >
        <div className="eth-address-input-container">
          <input
            className="eth-address-input"
            type="text"
            placeholder="Debt address"
            value={debtAddress}
            onChange={(e) => setDebtAddress(e.target.value)}
          />
        </div>
      </div>

      <div className="debt-info">
        {debt && debt.name && (
          <div >
            <>
              Token:
              <a className="link" rel="noreferrer" target="_blank" href={`${network.explorerUrl}/address/${debtAddress}`}>
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
            <a className="link" rel="noreferrer" target="_blank" href={`${network.explorerUrl}/address/${debt.vendor}`}>{shortenAddress(debt.vendor)}</a>
          </span>
        )}
        {debt && (
          <div title="Tokens being held by investors">
            Circulating supply: &nbsp;
            {circulatingSupply}
          </div>
        )}
        <div>
          Available Interests: &nbsp;
          {updatingAvailableInterest ? <Skeleton w={50} /> : availableInterests}

        </div>

        {debt && debt.rating && "Rating: " + debt!.rating}
      </div>
      {/*  {debt && debt.minRate && debt.minRate.length > 0 && (
        <div>
          Annual Min Rate: {debt?.minRate}
        </div>
      )} */}


      {signer != null && roles.includes("BOND ADMIN ROLE") && (
        <div className="row m1">
          <input type="text" className="sm-input" ref={cIndexRef} placeholder="Index" />
          <input type="text" className="sm-input" ref={rateRef} placeholder="rate %" />
          <button className="send-transaction-button" onClick={sendTransaction}>Send Transaction</button>
        </div>
      )}

      {
        loading ? (
          <div className="spinner-container">
            <div className="spinner"></div>
          </div>
        ) : debt ? (
          <>
            <CouponsTable
              updateCoupon={updateCoupon}
              contract={debtContract}
              coupons={debt.coupons}
              paymentToken={paymentToken}
              paymentSymbol={paymentSymbol}
              roles={roles}
              connectedAccount={isConnected ? address : undefined}
              onPaymentMade={async (index) => {
                updateCoupon(index);
                updateAvailableInterests();
              }}
              onRedeemMade={async (index) => {
                updateCoupon(index);
                updateAvailableInterests();
                setSyncCounter(sc => sc+1);
                return;
              }}
            />

            {debtContract && isConnected && (
              <PaymentHistory
                connectedAccount={address}
                contract={debtContract}
                roles={roles}
                paymentSymbol={paymentSymbol}
                explorerUrl={network.explorerUrl}
                syncCounter={syncCounter}
              />

            )}


          </>
        ) : <></>
      }

    </div>
  )
}
export default Main;