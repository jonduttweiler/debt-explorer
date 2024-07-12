import Web3 from "web3";

const formatDateStr = (date: Date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

const formatDate = (timestampSeconds: BigInt) => { 
  const date = new Date(Number(timestampSeconds) * 1000);
  return formatDateStr(date);
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
  status: number;
}

interface CouponsTableProps {
  coupons: Coupon[];
  paymentToken: string;
}

const CouponsTable: React.FC<CouponsTableProps> = ({ coupons, paymentToken}) => {
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
            <th>Nominal Value <br />({paymentToken})</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {coupons.map((coupon, i) => {
            return (
              <tr key={coupon.start_date.toString()}>
                <td>{`Coupon ${i + 1}`}</td>
                <td>{formatDate(coupon.start_date)}</td>
                <td>{formatDate(coupon.cutoff_date)}</td>
                <td>{formatDate(coupon.payment_date)}</td>
                <td>{Web3.utils.fromWei(coupon.annual_interest_rate * 100n, 18)}%</td>
                <td>{Web3.utils.fromWei(coupon.par_value.toString(), 18)}</td>
                <td>{formatStatus(coupon.status)}</td>
              </tr>
            )
          })}

        </tbody>
      </table>
    </div>
  )
}

export default CouponsTable;