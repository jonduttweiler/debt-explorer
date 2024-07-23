import { Contract, formatEther } from "ethers";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

const formatDateStr = (date: Date, full: boolean = false) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  let formattedDate = `${day}/${month}/${year}`;

  if (full) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    formattedDate += ` ${hours}:${minutes}:${seconds}`;
  }

  return formattedDate;
}

const formatDate = (timestampSeconds: BigInt, full: boolean = false) => {
  const date = new Date(Number(timestampSeconds) * 1000);
  return formatDateStr(date, full);
}

const formatStatus = (status: Number) => {
  switch (Number(status)) {
    case 0: return "Scheduled";
    case 1: return "Payable";
    default: return "";
  }
}
interface Coupon {
  start_date: BigInt;
  cutoff_date: BigInt;
  payment_date: BigInt;
  annual_interest_rate: bigint;
  par_value: number;
  actual_payment_date: BigInt;
  status: number;
}

interface CouponsTableProps {
  coupons: Coupon[];
  connectedAccount?: string,
  contract?: Contract
  paymentToken?: Contract;
  updateCoupon(index: number): Promise<void>;
}

const CouponsTable: React.FC<CouponsTableProps> = ({ contract, coupons, paymentToken, connectedAccount, updateCoupon }) => {

  const [interests, setInterests] = useState<any[]>([]);

  useEffect(() => {
    async function getInterests() {
      if (contract) {
        console.log(`Get interests from contract`);

        const interests = new Array(coupons.length);
        //We need be smart about the read from the blockchain, first of all, we need to bear in mind that the coupons are time ordered
        //So its no point on check interests for future cutoff, we only can query about the passed ones
        for (const [index, coupon] of coupons.entries()) {
          if (Number(coupon.cutoff_date) * 1000 <= new Date().getTime()) {
            interests[index] = await contract.calculateTotalInterestForCoupon(index);

          }
        }

        setInterests(interests);





        /*         function depositInterestsForCoupon(
                  uint256 couponIndex,
                  uint256 amount
              ) public onlyRole(BOND_DEPOSIT_ROLE) { */
      }
    }

    getInterests();


  }, [coupons]);

  async function payInterestOfCoupon(index: number) {
    const amountToPay = interests[index];

    console.log(`Send tx to pay coupon ${index} ${amountToPay}`)

    try {
      const allowance = await paymentToken!.allowance(connectedAccount, contract!.target);

      if (allowance < amountToPay) {
        const toast1 = toast.loading(
          `Sending transaction to approval 1/2. Please approve the transaction in your wallet.`);
        const tx1 = await paymentToken!.approve(contract!.target, amountToPay);
        console.log(tx1);
        toast.dismiss(toast1);
        await tx1.wait();

      }

      const toast2 = toast.loading(
        `Sending transaction to approval 2/2. Please approve the transaction in your wallet.`);
      const tx2 = await contract!.depositInterestsForCoupon(index, amountToPay);  
      await tx2.wait();
      toast.dismiss(toast2);
      console.log(tx2);
      toast.success("Payment made");

      updateCoupon(index);

    } catch (err) {
      console.log(err);
    }
    return "";
  }

  async function checkAllowance() {
    if (!paymentToken) return;
    console.log(`Checking allowance to spender: ${contract?.target} from owner: ${connectedAccount}`)
    const allowance = await paymentToken!.allowance(connectedAccount, contract!.target);

    toast.success(formatEther(allowance))

  }



  return (
    <div className="table-coupons">
      <table>
        <thead>
          <tr>
            <th>Coupon</th>
            <th>Start Date</th>
            <th>Cutoff Date</th>
            <th>Payment Date</th>
            <th>Rate</th>
            <th>Nominal Value <br />(USD)</th> {/* Get payment token from contract*/}
            <th>Status</th>
            {connectedAccount && (
              <>
                <th>Interest to pay</th>
                <th>Actions</th>
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
                <td>{formatEther(coupon.annual_interest_rate  * 100n)}%</td> {/* This is the annual one */}
                <td>{formatEther(coupon.par_value.toString())}</td>
                <td>{formatStatus(coupon.status)} &nbsp;
                  {coupon.status == 1 && (
                    `Paid at(${formatDate(coupon.actual_payment_date, true)})`
                  )}

                </td>
                {connectedAccount && (
                  <>
                    <td>{interests[i] && Number(formatEther(interests[i])).toFixed(5)}</td> {/* This will be an async op */}
                    <td>{interests[i] && (
                      <>
                        {coupon.status == 0 && (
                          <button
                            onClick={() => payInterestOfCoupon(i)}>
                            Pay
                          </button>

                        )}
          {/*               <button onClick={() => checkAllowance()}>
                          Check allowance
                        </button>
 */}
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