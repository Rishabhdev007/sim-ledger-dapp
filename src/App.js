// src/App.js
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import 'bootstrap/dist/css/bootstrap.min.css';

// Replace with your deployed SimLedgerV2 contract address
const CONTRACT_ADDRESS = "0xd30b398604c22dc07c4cd78a2166e8484d4f9013";

const contractAbi = [
  "function createSim(string calldata simId) external",
  "function topUpData(string calldata simId, uint256 amountKB, string calldata note) external",
  "function topUpVoice(string calldata simId, uint256 amountSecs, string calldata note) external",
  "function topUpSMS(string calldata simId, uint256 amountSMS, string calldata note) external",
  "function useData(string calldata simId, uint256 amountKB, string calldata note) external",
  "function useVoice(string calldata simId, uint256 amountSecs, string calldata note) external",
  "function useSMS(string calldata simId, uint256 amountSMS, string calldata note) external",
  "function getDataKB(string calldata simId) external view returns (uint256)",
  "function getVoiceSecs(string calldata simId) external view returns (uint256)",
  "function getSMSCount(string calldata simId) external view returns (uint256)",
  "function getTxCount(string calldata simId) external view returns (uint256)",
  "function getTransaction(string calldata simId, uint256 index) external view returns (int256,uint256,string,address)",
  "function transferSim(string calldata simId, address newOwner) external",
];

export default function App() {
  // provider / signer / contract
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);

  // UI state
  const [simId, setSimId] = useState("");
  const [dataKB, setDataKB] = useState(null);
  const [voiceSecs, setVoiceSecs] = useState(null);
  const [smsCount, setSmsCount] = useState(null);
  const [txns, setTxns] = useState([]);
  const [status, setStatus] = useState("");

  // input fields
  const [topUpDataAmount, setTopUpDataAmount] = useState("");
  const [topUpVoiceAmount, setTopUpVoiceAmount] = useState("");
  const [topUpSmsAmount, setTopUpSmsAmount] = useState("");
  const [useDataAmount, setUseDataAmount] = useState("");
  const [useVoiceAmount, setUseVoiceAmount] = useState("");
  const [useSmsAmount, setUseSmsAmount] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [transferTo, setTransferTo] = useState("");

  // init provider (ethers v6)
  useEffect(() => {
    if (window.ethereum) {
      const p = new ethers.BrowserProvider(window.ethereum);
      setProvider(p);

      // listen for accounts / chain changes to prompt reload
      window.ethereum.on && window.ethereum.on("chainChanged", () => window.location.reload());
      window.ethereum.on && window.ethereum.on("accountsChanged", () => window.location.reload());
    } else {
      setStatus("MetaMask not detected. Install it first.");
    }
    // cleanup listeners on unmount
    return () => {
      if (window.ethereum && window.ethereum.removeListener) {
        window.ethereum.removeListener("chainChanged", () => {});
        window.ethereum.removeListener("accountsChanged", () => {});
      }
    };
  }, []);

  // connect wallet
  async function connectWallet() {
    try {
      if (!window.ethereum) throw new Error("MetaMask not found");
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const p = provider ?? new ethers.BrowserProvider(window.ethereum);
      const s = await p.getSigner();
      const a = await s.getAddress();
      setSigner(s);
      setAccount(a);
      const c = new ethers.Contract(CONTRACT_ADDRESS, contractAbi, s);
      setContract(c);
      setStatus("Wallet connected: " + a);
      console.log("Connected contract:", c.address);
    } catch (err) {
      console.error(err);
      setStatus("Wallet connection failed: " + (err?.message || String(err)));
    }
  }

  // create SIM
  async function createSim() {
    if (!contract) return setStatus("Connect wallet first!");
    if (!simId) return setStatus("Enter SIM ID first");
    try {
      const tx = await contract.createSim(simId);
      setStatus("Creating SIM...");
      await tx.wait();
      setStatus("SIM created.");
      await loadSimData(simId);
    } catch (err) {
      console.error(err);
      setStatus(err?.error?.message || err?.message || String(err));
    }
  }

  // top-up functions
  async function topUpData() {
    if (!contract) return setStatus("Connect wallet first!");
    if (!simId) return setStatus("Enter SIM ID first");
    const amount = Number(topUpDataAmount || 0);
    if (amount <= 0) return setStatus("Enter amount in KB");
    try {
      const tx = await contract.topUpData(simId, ethers.toBigInt(amount), noteInput || "Data top-up");
      setStatus("Top-up data tx sent...");
      await tx.wait();
      setStatus("Data top-up confirmed.");
      setTopUpDataAmount("");
      await loadSimData(simId);
    } catch (err) {
      console.error(err);
      setStatus(err?.error?.message || err?.message || String(err));
    }
  }

  async function topUpVoice() {
    if (!contract) return setStatus("Connect wallet first!");
    if (!simId) return setStatus("Enter SIM ID first");
    const amount = Number(topUpVoiceAmount || 0);
    if (amount <= 0) return setStatus("Enter voice seconds");
    try {
      const tx = await contract.topUpVoice(simId, ethers.toBigInt(amount), noteInput || "Voice top-up");
      setStatus("Top-up voice tx sent...");
      await tx.wait();
      setStatus("Voice top-up confirmed.");
      setTopUpVoiceAmount("");
      await loadSimData(simId);
    } catch (err) {
      console.error(err);
      setStatus(err?.error?.message || err?.message || String(err));
    }
  }

  async function topUpSMS() {
    if (!contract) return setStatus("Connect wallet first!");
    if (!simId) return setStatus("Enter SIM ID first");
    const amount = Number(topUpSmsAmount || 0);
    if (amount <= 0) return setStatus("Enter SMS amount");
    try {
      const tx = await contract.topUpSMS(simId, ethers.toBigInt(amount), noteInput || "SMS top-up");
      setStatus("Top-up SMS tx sent...");
      await tx.wait();
      setStatus("SMS top-up confirmed.");
      setTopUpSmsAmount("");
      await loadSimData(simId);
    } catch (err) {
      console.error(err);
      setStatus(err?.error?.message || err?.message || String(err));
    }
  }

  // usage functions
  async function useDataNow() {
    if (!contract) return setStatus("Connect wallet first!");
    if (!simId) return setStatus("Enter SIM ID first");
    const amount = Number(useDataAmount || 0);
    if (amount <= 0) return setStatus("Enter KB to use");
    try {
      const tx = await contract.useData(simId, ethers.toBigInt(amount), noteInput || "Data usage");
      setStatus("Usage tx sent...");
      await tx.wait();
      setStatus("Data usage recorded.");
      setUseDataAmount("");
      await loadSimData(simId);
    } catch (err) {
      console.error(err);
      setStatus(err?.error?.message || err?.message || String(err));
    }
  }

  async function useVoiceNow() {
    if (!contract) return setStatus("Connect wallet first!");
    if (!simId) return setStatus("Enter SIM ID first");
    const amount = Number(useVoiceAmount || 0);
    if (amount <= 0) return setStatus("Enter seconds to use");
    try {
      const tx = await contract.useVoice(simId, ethers.toBigInt(amount), noteInput || "Voice usage");
      setStatus("Voice usage tx sent...");
      await tx.wait();
      setStatus("Voice usage recorded.");
      setUseVoiceAmount("");
      await loadSimData(simId);
    } catch (err) {
      console.error(err);
      setStatus(err?.error?.message || err?.message || String(err));
    }
  }

  async function useSMSNow() {
    if (!contract) return setStatus("Connect wallet first!");
    if (!simId) return setStatus("Enter SIM ID first");
    const amount = Number(useSmsAmount || 0);
    if (amount <= 0) return setStatus("Enter SMS count to use");
    try {
      const tx = await contract.useSMS(simId, ethers.toBigInt(amount), noteInput || "SMS usage");
      setStatus("SMS usage tx sent...");
      await tx.wait();
      setStatus("SMS usage recorded.");
      setUseSmsAmount("");
      await loadSimData(simId);
    } catch (err) {
      console.error(err);
      setStatus(err?.error?.message || err?.message || String(err));
    }
  }

  // transfer owner
  async function transferSimNow() {
    if (!contract) return setStatus("Connect wallet first!");
    if (!simId) return setStatus("Enter SIM ID first");
    if (!transferTo) return setStatus("Enter receiver address");
    try {
      const tx = await contract.transferSim(simId, transferTo);
      setStatus("Transfer tx sent...");
      await tx.wait();
      setStatus("SIM transferred.");
      setTransferTo("");
      await loadSimData(simId);
    } catch (err) {
      console.error(err);
      setStatus(err?.error?.message || err?.message || String(err));
    }
  }

  // load balances & txns
  async function loadSimData(id) {
    if (!contract) {
      setStatus("Connect wallet first!");
      return;
    }
    if (!id) return setStatus("Enter SIM ID first");
    try {
      const data = await contract.getDataKB(id);
      const voice = await contract.getVoiceSecs(id);
      const sms = await contract.getSMSCount(id);
      setDataKB(data.toString());
      setVoiceSecs(voice.toString());
      setSmsCount(sms.toString());

      const count = await contract.getTxCount(id);
      const total = Number(count);
      const list = [];
      for (let i = 0; i < total; i++) {
        const t = await contract.getTransaction(id, i);
        list.push({
          delta: Number(t[0]),
          ts: new Date(Number(t[1]) * 1000),
          note: t[2],
          by: t[3],
        });
      }
      setTxns(list.reverse());
      setStatus("Loaded SIM data.");
    } catch (err) {
      console.error(err);
      setStatus(err?.error?.message || err?.message || String(err));
    }
  }

  // helper conversions
  const dataMB = dataKB ? (Number(dataKB) / 1024).toFixed(2) : "-";
  const voiceMin = voiceSecs ? Math.floor(Number(voiceSecs) / 60) : "-";

  return (
    <div className="container py-5" style={{ maxWidth: 1100 }}>
      <div className="text-center mb-4">
        <h1 className="mb-1">📱 SIM Balance & Transaction DApp</h1>
        <small className="text-muted">Contract: <code style={{fontSize:12}}>{CONTRACT_ADDRESS}</code></small>
      </div>

      <div className="mb-4 d-flex justify-content-between align-items-center">
        {!account ? (
          <button className="btn btn-primary" onClick={connectWallet}>Connect MetaMask</button>
        ) : (
          <div>
            <strong>Wallet:</strong> <span className="text-monospace">{account}</span>
          </div>
        )}
      </div>

      <div className="card mb-4 shadow-sm">
        <div className="card-body">
          <div className="mb-3">
            <label className="form-label">SIM ID</label>
            <input
              className="form-control"
              placeholder="+919876543210"
              value={simId}
              onChange={(e) => setSimId(e.target.value)}
            />
          </div>

          <div className="d-flex gap-2">
            <button className="btn btn-outline-secondary" onClick={() => loadSimData(simId)}>Load SIM</button>
            <button className="btn btn-success" onClick={createSim}>Create SIM on-chain</button>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="card p-3">
            <h6 className="mb-1">📶 Data</h6>
            <div className="fs-4">{dataMB} MB</div>
            <small className="text-muted">{dataKB ? dataKB + " KB" : ""}</small>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card p-3">
            <h6 className="mb-1">📞 Voice</h6>
            <div className="fs-4">{voiceMin} min</div>
            <small className="text-muted">{voiceSecs ? voiceSecs + " sec" : ""}</small>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card p-3">
            <h6 className="mb-1">✉️ SMS</h6>
            <div className="fs-4">{smsCount ?? "-"}</div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="card p-3">
            <h6>Top-up</h6>
            <input className="form-control mb-2" placeholder="Data KB (e.g. 1024)" value={topUpDataAmount} onChange={(e)=>setTopUpDataAmount(e.target.value)} />
            <button className="btn btn-primary w-100 mb-2" onClick={topUpData}>Top-up Data</button>

            <input className="form-control mb-2" placeholder="Voice secs (e.g. 600)" value={topUpVoiceAmount} onChange={(e)=>setTopUpVoiceAmount(e.target.value)} />
            <button className="btn btn-primary w-100 mb-2" onClick={topUpVoice}>Top-up Voice</button>

            <input className="form-control mb-2" placeholder="SMS amount" value={topUpSmsAmount} onChange={(e)=>setTopUpSmsAmount(e.target.value)} />
            <button className="btn btn-primary w-100" onClick={topUpSMS}>Top-up SMS</button>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card p-3">
            <h6>Consume / Use</h6>
            <input className="form-control mb-2" placeholder="Use Data KB (e.g. 100)" value={useDataAmount} onChange={(e)=>setUseDataAmount(e.target.value)} />
            <button className="btn btn-warning w-100 mb-2" onClick={useDataNow}>Use Data</button>

            <input className="form-control mb-2" placeholder="Use Voice secs" value={useVoiceAmount} onChange={(e)=>setUseVoiceAmount(e.target.value)} />
            <button className="btn btn-warning w-100 mb-2" onClick={useVoiceNow}>Use Voice</button>

            <input className="form-control mb-2" placeholder="Use SMS" value={useSmsAmount} onChange={(e)=>setUseSmsAmount(e.target.value)} />
            <button className="btn btn-warning w-100" onClick={useSMSNow}>Use SMS</button>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card p-3">
            <h6>Transfer SIM</h6>
            <input className="form-control mb-2" placeholder="0xReceiverAddress" value={transferTo} onChange={(e)=>setTransferTo(e.target.value)} />
            <button className="btn btn-outline-dark w-100" onClick={transferSimNow}>Transfer</button>

            <div className="mt-3">
              <label className="form-label small">Note (optional)</label>
              <input className="form-control" placeholder="Transaction note" value={noteInput} onChange={(e)=>setNoteInput(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <h5>Transactions</h5>
          {txns.length === 0 ? (
            <p className="text-muted">No transactions yet.</p>
          ) : (
            txns.map((t, i) => (
              <div key={i} className="border rounded p-3 mb-2">
                <div className="fw-bold">{t.note}</div>
                <div>Amount: {t.delta >= 0 ? `+${t.delta}` : t.delta}</div>
                <div className="text-muted small">By: {t.by}</div>
                <div className="text-muted small">{t.ts.toLocaleString()}</div>
              </div>
            ))
          )}

          <div className="mt-3 text-muted small">{status}</div>
        </div>
      </div>
    </div>
  );
}
