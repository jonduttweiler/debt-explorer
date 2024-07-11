import { useCallback, useEffect, useState } from "react";
import debtAbi from "../contracts/debt.abi.json";
import Web3 from "web3";
import CouponsTable from "./CouponsTable";
const paymentToken = "USD";

const providerUrl = "https://alfajores-forno.celo-testnet.org";
const explorerUrl = "https://alfajores.celoscan.io";

const isNotZeroAddress = (address) => {
  const zeroAddress = "0x0000000000000000000000000000000000000000";
  return Web3.utils.isAddress(address) && address.toLowerCase() !== zeroAddress.toLowerCase();
}

function Main() {
  const [debtAddress, setDebtAddress] = useState("0xcb13dd3cdeef68fb54ab7a1ab404c92ae04c047d");
  const [loading, setLoading] = useState(false);
  const [coupons, setCoupons] = useState([]);
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [vendor, setVendor] = useState("");
  const [rating, setRating] = useState("");


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

      setTokenName(await contract.methods.name().call());
      setTokenSymbol(await contract.methods.symbol().call());
      setVendor(await contract.methods.vendor().call());
      setRating(await contract.methods.rating().call());
      
      const couponsN = await contract.methods.couponsLength().call();
      let coupons_ = [];
      for (let i = 0; i < couponsN; i++) {
        const coupon = await contract.methods.coupons(i).call();
        coupons_.push(coupon);
      }
      setCoupons(coupons_);


      setLoading(false);
    } catch (error) {
      console.error('Error loading contract:', error);
      setLoading(false);
    }
  }, [debtAddress]);

  useEffect(function () {
    loadContract();
  }, [loadContract]);


  return (
    <div>
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