import { useEffect, useState } from "react";
import { Contract } from 'web3-eth-contract';
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
  const [debtAddress, setDebtAddress] = useState("0xcb13dd3cdeef68fb54ab7a1ab404c92ae04c047d"); /* No puede ser un address */
  const [loading, setLoading] = useState(false);
  const [coupons, setCoupons] = useState([]);
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [vendor, setVendor] = useState("");
  const [rating, setRating] = useState("");

  useEffect(function () {
    if (debtAddress?.length == 42) {
      loadContract(debtAddress);
      return;
    }
  }, [debtAddress])

  async function loadContract() {
    console.log(`Load contract at ${debtAddress}`);
    try {
      setLoading(true);
      setCoupons([]);
      const web3 = new Web3(providerUrl);
      const contract = new web3.eth.Contract(debtAbi, debtAddress);
      console.log(contract);

      if (contract) {
        console.log("Lets get the coupons")
        const couponsN = await contract.methods.couponsLength().call();


        setTokenName(await contract.methods.name().call());
        setTokenSymbol(await contract.methods.symbol().call());
        setVendor(await contract.methods.vendor().call());
        setRating(await contract.methods.rating().call());


        let coupons_ = [];
        for (let i = 0; i < couponsN; i++) {
          const coupon = await contract.methods.coupons(i).call(); //check order
          coupons_.push(coupon);
        }
        console.log(coupons_);
        setCoupons(coupons_);


      }

      setLoading(false);
    } catch (error) {

    }

    setLoading(false);
  }



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
          <a className="link" target="_blank" href={`${explorerUrl}/address/${debtAddress}`}>
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