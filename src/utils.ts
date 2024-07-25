import { formatEther, isAddress, ZeroAddress } from "ethers";

export const isNotZeroAddress = (address: string) => {
    return isAddress(address) && address.toLowerCase() !== ZeroAddress;
}

export const shortenAddress = (address: string) => {
    if (address.length > 10) {
        return `${address.substring(0, 6)}...${address.substring(address.length - 4, address.length)}`;
    }
    return address;
}


export const sleep = (ms: number = 1000) => (new Promise((resolve, reject) => { setTimeout(() => resolve(ms), ms) }))
export const formatDateStr = (date: Date, full: boolean = false) => {
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

export const formatDate = (timestampSeconds: BigInt, full: boolean = false) => {
  const date = new Date(Number(timestampSeconds) * 1000);
  return formatDateStr(date, full);
}

export const formatStatus = (status: Number) => {
  switch (Number(status)) {
    case 0: return "Scheduled";
    case 1: return "Payable";
    default: return "";
  }
}

export const getCouponRate = (coupon: Coupon) => {
  const yearInSeconds = 31557600;
  const f = Number(coupon.cutoff_date - coupon.start_date) / yearInSeconds;

  const yearRate = Number(formatEther(coupon.annual_interest_rate));

  let fRate = yearRate * f * 100;


  return `${fRate.toFixed(2)} %` //${formatEther(1n* 100n)
}