import { Contract, formatEther } from "ethers";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Skeleton from "./utils/Skeleton";
import { formatDate, formatStatus, getCouponRate } from "../utils";

declare global {
  interface Window {
    toast?: any;
  }
}

window.toast = toast;

interface CouponsTableProps {
  coupons: Coupon[];
  connectedAccount?: string,
  contract?: Contract
  paymentToken?: Contract;
  paymentSymbol?: string;
  updateCoupon(index: number): Promise<void>;
  onPaymentMade?(index: number): Promise<void>;
  onRedeemMade?(index: number): Promise<void>;
  roles: string[];
}

const CouponsTable: React.FC<CouponsTableProps> = ({ contract, coupons, paymentToken, paymentSymbol, connectedAccount, roles, updateCoupon, onPaymentMade, onRedeemMade }) => {

  const [isPaying, setIsPaying] = useState<number | undefined>();
  const [isClaiming, setIsClaiming] = useState<number | undefined>();
  const [loading, setLoading] = useState<boolean>(false);
  const [claimable, setClaimable] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [interests, setInterests] = useState<any[]>([]);
  const [circulatingSupply, setCirculatingSupply] = useState<any[]>([]);

  
  useEffect(() => {
    async function getInterests() {
      if (contract) {
        console.log(`[${new Date()}]Get interests from contract`);

        const interests = new Array(coupons.length);
        const circulating = new Array(coupons.length);

        setLoading(true);
        try {

          //We need be smart about the read from the blockchain, first of all, we need to bear in mind that the coupons are time ordered
          //So its no point on check interests for future cutoff, we only can query about the passed ones
          for (const [index, coupon] of coupons.entries()) {
            if (Number(coupon.cutoff_date) * 1000 <= new Date().getTime()) {
              interests[index] = await contract.calculateTotalInterestForCoupon(index);
              circulating[index] = await contract.getCirculatingSupplyAt(coupon.cutoff_date);
            }
          }

          setInterests(interests);
          setCirculatingSupply(circulating);
          setLoading(false);
        } catch (err) {
          console.log(err)
          setLoading(false);
        }
      }
    }

    getInterests();

  }, [coupons]);

  async function updateClaimable() {
    if (!contract) return;

    const balances = new Array(coupons.length);
    const claimable = new Array(coupons.length);

    setLoading(true);
    try {
      for (const [index, coupon] of coupons.entries()) {
        if (Number(coupon.cutoff_date) * 1000 <= new Date().getTime()) {
          try {
            let balance = await contract.snapshotBalanceOf(coupon.cutoff_date, connectedAccount);
            balances[index] = balance;
          } catch (err) {
            // console.log(err);
          }
          try {
            claimable[index] = await contract.calculateInvestorRedemption(index);
          } catch (err) {
            // console.log(err)
            claimable[index] = 0;
          }
        }
      }

      setBalances(balances);
      setClaimable(claimable);
      setLoading(false);
    } catch (err) {
      console.log(err)
      setLoading(false);
    }

  }

  useEffect(() => {
    updateClaimable();
  }, [coupons, connectedAccount])



  async function payInterestOfCoupon(index: number) {
    const amountToPay = interests[index];
    let toast1, toast2;

    if (isPaying) return;

    console.log(`Send tx to pay coupon ${index} ${amountToPay}`)

    try {
      setIsPaying(index);

      const allowance = await paymentToken!.allowance(connectedAccount, contract!.target);

      if (allowance < amountToPay) {
        toast1 = toast.loading(t => (
          <>
            Sending transaction to approval 1/2. Please approve the transaction in your wallet.
            <div className="v-centered">
              <a className="inline-button" onClick={() => toast.dismiss(t.id)}>
                Close
              </a>
            </div>
          </>
        ));

        const tx1 = await paymentToken!.approve(contract!.target, amountToPay);
        console.log(tx1);
        toast.dismiss(toast1);
        await tx1.wait();
      }



      toast2 = toast.loading(t => (
        <>
          Sending transaction to approval 2/2. Please approve the transaction in your wallet.
          <div className="v-centered">
            <a className="inline-button" onClick={() => toast.dismiss(t.id)}>
              Close
            </a>
          </div>
        </>
      ));
      const tx2 = await contract!.depositInterestsForCoupon(index, amountToPay);
      await tx2.wait();
      toast.dismiss(toast2);
      console.log(tx2);
      toast.success("Payment made");
      if (typeof onPaymentMade === 'function') {
        onPaymentMade(index);
      }
      setIsPaying(undefined);
      updateCoupon(index);

    } catch (err) {
      console.log(err);
      toast.dismiss(toast1);
      toast.dismiss(toast2);
      setIsPaying(undefined);
    }
    return "";
  }

  async function claimInterestOfCoupon(index: number) {
    setIsClaiming(index);
    if (isClaiming) return;

    let toast1;

    try {
      toast1 = toast.loading(t => (
        <>
          Sending transaction to claim interests for coupon {index + 1}. Please approve the transaction in your wallet.
          <div className="v-centered">
            <a className="inline-button" onClick={() => toast.dismiss(t.id)}>
              Close
            </a>
          </div>
        </>
      ));

      const tx1 = await contract!.redeemCoupon(index);
      console.log(tx1);
      toast.dismiss(toast1);
      await tx1.wait();

      if (typeof onRedeemMade === 'function') {
        onRedeemMade(index);
      }
      toast.success(`Interest for coupon ${index + 1} claimed `)


      setIsClaiming(undefined);

    } catch (err) {
      console.log(err);
      toast.dismiss(toast1);
      if (err instanceof Error) {
        toast.error(err.message);
    } else {
        // Handle unexpected error types
        toast.error("An unknown error occurred");
    }

    }
    setIsClaiming(undefined);



  }



  async function checkAllowance() {
    if (!paymentToken) return;
    console.log(`Checking allowance to spender: ${contract?.target} from owner: ${connectedAccount}`)
    const allowance = await paymentToken!.allowance(connectedAccount, contract!.target);

    toast.success(formatEther(allowance))

  }

  const isAdmin = roles.includes("BOND ADMIN ROLE");
  const canDeposit = roles.includes("BOND DEPOSIT ROLE");

  return (
    <div className="table-coupons">
      <table className="table-coupons__table">
        <thead>
          <tr>
            <th>Coupon</th>
            <th>Start<br /> Date</th>
            <th>Cutoff Date</th>
            <th>Payment<br /> Date</th>
            <th>Coupon<br /> Rate</th>
            <th>Nominal <br />Value <br />{paymentSymbol? `(${paymentSymbol})` : ""}</th> {/* Get payment token from contract*/}
            <th>Status</th>
            <th>Circulating<br />supply</th>
            <th>Total Interest <br /> to pay {`(${paymentSymbol})`}</th> {/* Esto deberia ser si el connected tiene el rol de pagar */}
            {connectedAccount && (
              <>
              <th>Your balance <br /> at cutoff</th>
              <th>Your Claimable<br />Interest {`(${paymentSymbol})`}</th>
                <th className="actions">Actions</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {coupons.map((coupon, i) => {

            return (
              <tr key={coupon.start_date.toString()}>
                <td>{`Coupon ${i + 1}`}</td>
                <td>{formatDate(coupon.start_date)}</td>
                <td>{formatDate(coupon.cutoff_date, true)}</td>
                <td>{formatDate(coupon.payment_date)}</td>
                <td>
                  <span
                  className="no-text-cursor"
                   title={`Annual rate: ${formatEther(coupon.annual_interest_rate  * 100n)} %`}
                    >
                    {getCouponRate(coupon)}
                  </span>
                </td> 
                <td>{formatEther(coupon.par_value.toString())}</td>
                <td>
                  <span
                    className={`${coupon.status == 1 ? "payable" : ""} no-text-cursor`}
                    title={coupon.status == 1
                      ? `The project developer paid on ${formatDate(coupon.actual_payment_date, true)}`
                      : "The project developer has not made the payment yet"}
                  >
                    {formatStatus(coupon.status)}
                  </span>&nbsp;

                </td>
                <td>{loading ? <Skeleton w={50} /> : circulatingSupply[i]?.toString()}</td>
                <td>{loading ? <Skeleton w={50} /> : interests[i] && Number(formatEther(interests[i])).toFixed(5)}</td>
                {connectedAccount && (
                  <>
                  <td>{loading ? <Skeleton w={50} /> : balances[i]?.toString()}</td>
                  <td>{loading ? <Skeleton w={50} /> : claimable[i] && Number(formatEther(claimable[i])).toFixed(5)}</td>
                    <td>{interests[i] && (
                      <>
                        {coupon.status == 0 && canDeposit && (
                          <button
                            disabled={isPaying !== undefined && isPaying !== i}
                            onClick={() => payInterestOfCoupon(i)}
                            className={`${isPaying === i ? 'paying' : ''} action`}
                          >
                            {isPaying === i ? <>
                              Paying...
                            </> : 'Pay'}
                          </button>
                        )}
                        {coupon.status == 1  && (
                          <button
                            disabled={isClaiming !== undefined && isClaiming !== i || claimable[i] == 0}
                            onClick={() => claimInterestOfCoupon(i)}
                            className={`${isClaiming === i ? 'paying' : ''} action claim-button`}
                          >
                            {isClaiming === i ? <>
                              Claiming...
                            </> : 'Claim'}
                          </button>
                        )}

                      </>
                    )}</td>



                  </>
                )}

              </tr>
            )
          })}

        </tbody>
      </table>
    </div>
  )
}

export default CouponsTable;