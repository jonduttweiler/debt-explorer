import { formatEther, isError } from 'ethers';
import toast, { CheckmarkIcon, ErrorIcon, LoaderIcon } from 'react-hot-toast';
import { alfajores, shortenAddress } from './components/main';

export function showPendingTransactionToast(txHash: string, toastId: string) {
  toast(
    (t) => (
      <div>
        <div>Transaction sent: </div>
        <a rel="noreferrer" target="_blank" href={`${alfajores.explorerUrl}/tx/${txHash}`}>
          {shortenAddress(txHash)}
        </a>.
        <div>Waiting for confirmations...</div>
      </div>
    ),
    {
      icon: <LoaderIcon />,
      duration: 100000,
      id: toastId,
    }
  );
}

export function showTransactionConfirmedToast(txHash: string, toastId: string) {
  toast(
    (t) => (
      <div>
        <div>Transaction confirmed: </div>
        <a rel="noreferrer" target="_blank" href={`${alfajores.explorerUrl}/tx/${txHash}`}>
          {shortenAddress(txHash)}
        </a>.
      </div>
    ),
    {
      icon: <CheckmarkIcon />,
      duration: 4000,
      id: toastId,
    }
  );
}

export function showLoadingToast(couponIndex: number, rate: bigint): string {
  const toastId = toast.loading(
    `Sending transaction to update coupon #${couponIndex} with a rate of ${(Number(formatEther(rate)) * 100).toFixed(2)}%. Please approve the transaction in your wallet.`,
    { duration: 100000 }
  );
  return toastId;
}


export function handleTransactionError(err: any, toastId: string) {
  console.log(err);
  console.log(err.code);

  let message = "";
  if (isError(err, "UNKNOWN_ERROR")) {
    message = err.error?.message || "Unknown error";
  } else if (isError(err, "CALL_EXCEPTION")) {
    message = err.reason || "Unknown error";
  }
  if (toastId) {
    toast.error(
      (t) => (
        <div>
          <div>Transaction failed: </div>
          <div>{message}</div>
        </div>
      ),
      {
        icon: <ErrorIcon />,
        duration: 4000,
        id: toastId,
      }
    );
  }
}