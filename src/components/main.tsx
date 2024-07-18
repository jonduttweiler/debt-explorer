import { useEffect, useRef, useState } from "react";
import { useParams } from 'react-router-dom';
import debtAbi from "../contracts/debt.abi.json";
//import Web3, { AbiItem, Contract, TransactionRevertedWithoutReasonError } from "web3";
import CouponsTable from "./CouponsTable";
import { createWeb3Modal, defaultConfig, useDisconnect, useWeb3ModalAccount, useWeb3ModalProvider } from '@web3modal/ethers/react'
import { useWeb3Modal } from '@web3modal/ethers/react'
import { BrowserProvider, Contract, formatEther, isAddress, JsonRpcProvider, JsonRpcSigner, keccak256, toUtf8Bytes, TransactionResponse, ZeroAddress } from "ethers";
import toast from 'react-hot-toast';
import { handleTransactionError, showLoadingToast, showPendingTransactionToast, showTransactionConfirmedToast } from "../toast-utils";


const paymentToken = "USD";
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


const isNotZeroAddress = (address: string) => {
  return isAddress(address) && address.toLowerCase() !== ZeroAddress;
}

export const shortenAddress = (address: string) => {
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
  const { address: debtAddressParam } = useParams();
  const { open } = useWeb3Modal();
  const { disconnect } = useDisconnect();
  const { address, chainId, isConnected } = useWeb3ModalAccount();
  const { walletProvider } = useWeb3ModalProvider();
  const [signer, setSigner] = useState<JsonRpcSigner | null>();
  const [debtAddress, setDebtAddress] = useState<string>(debtAddressParam || "0x95f92dE0EE45CD978E10D44c68fE893bAF2Cfb07");
  const [loading, setLoading] = useState<boolean>(false);
  const [debt, setDebt] = useState<Debt>();
  const [debtContract, setDebtContract] = useState<Contract>();
  const [roles, setRoles] = useState<string[]>([]); /* Should be a set */



  const cIndexRef = useRef<HTMLInputElement>(null);
  const rateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isConnected) {
      loadDataFromContractWithSigner();
    } else {
      loadDataFromContractWithProvider();


    }
  }, [isConnected])


  async function loadDataFromContractWithProvider() {
    let provider = new JsonRpcProvider(alfajores.rpcUrl);
    const debtContract = new Contract(debtAddress, debtAbi, provider);
    setSigner(null);
    loadDataFromContract(debtContract);
    setDebtContract(debtContract);
  }

  async function loadDataFromContractWithSigner() {
    const ethersProvider = new BrowserProvider(walletProvider!);
    const signer = await ethersProvider.getSigner();
    setSigner(signer);
    const debtContract = new Contract(debtAddress, debtAbi, signer);
    loadDataFromContract(debtContract);
    setDebtContract(debtContract);

    let roles: string[] = [];

    if (await debtContract.hasRole(BOND_ADMIN_ROLE, signer.address)) {
      roles.push("BOND ADMIN ROLE");
    }
    if (await debtContract.hasRole(VALIDATOR_ROLE, signer.address)) {
      roles.push("VALIDATOR ROLE");
    }
    if (await debtContract.hasRole(BOND_DEPOSIT_ROLE, signer.address)) {
      roles.push("BOND DEPOSIT ROLE");
    }


    setRoles(roles);


  }

  /* TODO: CHECK ROLES TOO */
  async function loadDataFromContract(contract: Contract) {
    setLoading(true);
    try {
      const couponsN = await contract.couponsLength();
      const ethValue = formatEther(await contract.annualMinRate());
      let coupons_ = [];
      for (let i = 0; i < Number(couponsN); i++) {
        const coupon = await contract.coupons(i);
        coupons_.push(coupon);
      }
      setLoading(false);
      setDebt({
        name: await contract.name(),
        symbol: await contract.symbol(),
        vendor: await contract.vendor(),
        rating: await contract.rating(),
        minRate: `${Number(ethValue) * 100} %`,
        coupons: coupons_
      });

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



  async function sendTransaction() {

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

  return (
    <div>
      <div className="top-right">
        {!isConnected ? (
          <button onClick={() => open()} className="connect-wallet-button">Connect wallet</button>
        ) : (
          <div className="current-account">
            <div>{shortenAddress(address!)} </div>

            <div className="roles-container">
              {roles.map(role => (
                <div key={role}>{role}</div>
              ))}
            </div>
            <div>
              {roles.length == 0 && `No roles detected`}
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

      <div>
        {debt && debt.name && (
          <div className="m1">
            <>
              Token:
              <a className="link" rel="noreferrer" target="_blank" href={`${alfajores.explorerUrl}/address/${debtAddress}`}>
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
            <a className="link" rel="noreferrer" target="_blank" href={`${alfajores.explorerUrl}/address/${debt.vendor}`}>{shortenAddress(debt.vendor)}</a>
          </span>
        )}


        {debt && debt.rating && "Rating: " + debt!.rating}
      </div>
      {debt && debt.minRate.length > 0 && (
        <div>
          Annual Min Rate: {debt?.minRate}
        </div>
      )}


      {signer != null && (
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
        ) : debt ? <CouponsTable
          coupons={debt.coupons}
          paymentToken={paymentToken}
        /> : <></>
      }

    </div>
  )
}
export default Main;