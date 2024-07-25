import React, { useEffect, useState } from 'react';
import { ethers, Contract, formatEther } from 'ethers';
import { formatDate, shortenAddress } from '../utils';


interface PaymentsHistoryProps {
  contract: Contract;
  connectedAccount?: string,
  roles: string[];
  paymentSymbol?: string;
  explorerUrl: string;
  syncCounter: number
}

const PaymentsHistory: React.FC<PaymentsHistoryProps> = ({ contract, paymentSymbol, explorerUrl, syncCounter }) => {
  const [paidEvents, setPaidEvents] = useState<Paid[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const getPastEvents = async () => {
    try {
      const filter = contract.filters.CouponPaid();
      const fromBlock = 0;
      const toBlock = 'latest';

      const events = await contract.queryFilter(filter, fromBlock, toBlock);

      const paidEvents = await Promise.all(events.map(async event => {
        if ("args" in event) {
          const { couponIndex, who, tokenAmount } = event.args;
          const paid: Paid = {
            tx: event.transactionHash,
            when: (await event.getBlock()).timestamp,
            who: who,
            couponIndex: couponIndex,
            amount: tokenAmount
          };
          return paid;
        }
      }));

      const validPaidEvents = paidEvents.filter((paid): paid is Paid => paid !== undefined);
      setPaidEvents(validPaidEvents);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getPastEvents();
  }, [contract, syncCounter]);

  if (loading) {
    return (
      <div className="payments-container section">
        <h2>Payments History</h2>
        <div className="spinner-container">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="payments-container section">
      <h2>Payments History</h2>

      {paidEvents.length == 0 && (
        <div>No paid events found</div>
      )}
      {paidEvents.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Transaction Hash</th>
              <th>Who</th>
              <th>Coupon Index</th>
              <th>Amount {`(${paymentSymbol})`}</th>
            </tr>
          </thead>
          <tbody>
            {paidEvents.map((event, index) => (
              <tr key={index}>
                <td>{formatDate(BigInt(event.when), true)}</td>
                <td>
                  <a className="link" rel="noreferrer" target="_blank" href={`${explorerUrl}/tx/${event.tx}`}>
                    {event.tx && shortenAddress(event.tx)}
                  </a></td>
                <td>
                  <a className="link" rel="noreferrer" target="_blank" href={`${explorerUrl}/address/${event.who}`}>
                    {shortenAddress(event.who)}
                  </a>
                </td>
                <td>{event.couponIndex.toString()}</td>
                <td>{formatEther(event.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}


    </div>
  );
};

export default PaymentsHistory;
