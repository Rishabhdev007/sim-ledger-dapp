// src/App.js
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";

/*
  Make sure to replace CONTRACT_ADDRESS with your deployed SimLedgerV2 contract address
*/
const CONTRACT_ADDRESS = "0xd30b398604c22dc07c4cd78a2166e8484d4f9013";

// ABI (minimal for SimLedgerV2)
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
  "event TopUpData(string simId, address indexed by, uint256 amountKB, uint256 newDataKB, string note)"
];

export default function App() {
  const [provider, setProvider] = useState(null); // ethers v6 BrowserProvider
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);

  const [simId, setSimId] = useState("");
  const [dataKB, setDataKB] = useState(null);
  const [voiceSecs, setVoiceSecs] = useState(null);
  const [smsCount, setSmsCount] = useState(null);
  const [txns, setTxns] = useState([]);
  const [status, setStatus] = useState("");

  // input fields for top-up / use / transfer
  const [topUpDataAmount, setTopUpDataAmount] = useState("");
  const [topUpVoiceAmount, setTopUpVoiceAmount] = useState("");
  const [topUpSmsAmount, setTopUpSmsAmount] = useState("");
  const [useDataAmount, setUseDataAmount] = useState("");
  const [useVoiceAmount, setUseVoiceAmount] = useState("");
  const [useSmsAmount, setUseSmsAmount] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [transferTo, setTransferTo] = useState("");

  // init provider (ethers v6 BrowserProvider)
  useEffect(() => {
    if (window.ethereum) {
      const p = new ethers.BrowserProvider(window.ethereum);
      setProvider(p);
    } else {
      setStatus("MetaMask not detected. Install it first.");
    }

    // optional: reload on chain change to keep things simple
    if (window.ethereum) {
      const onChainChanged = () => window.location.reload();
      window.ethereum.on("chainChanged", onChainChanged);
      return () => {
        window.ethereum.removeListener("chainChanged", onChainChanged);
      };
    }
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
      setStatus("Wallet connect failed: " + (err?.message || String(err)));
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

  // top-ups
  async function topUpData() {
    if (!contract) return setStatus("Connect wallet first!");
    if (!simId) return setStatus("Enter SIM ID first");
    const amount = Number(topUpDataAmount || 0);
    if (amount <= 0) return setStatus("Enter amount in KB (positive)");
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
    if (amount <= 0) return setStatus("Enter voice amount in seconds");
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

  // usage (consume)
  async function useDataNow() {
    if (!contract) return setStatus("Connect wallet first!");
    if (!simId) return setStatus("Enter SIM ID first");
    const amount = Number(useDataAmount || 0);
    if (amount <= 0) return setStatus("Enter amount in KB to consume");
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
    if (amount <= 0) return setStatus("Enter voice seconds to consume");
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
    if (amount <= 0) return setStatus("Enter SMS count to consume");
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

  // transfer ownership
  async function transferSimNow() {
    if (!contract) return setStatus("Connect wallet first!");
    if (!simId) return setStatus("Enter SIM ID first");
    if (!transferTo) return setStatus("Enter new owner address");
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

  // read data + txns
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

      // transactions
      const count = await contract.getTxCount(id);
      const total = Number(count);
      const list = [];
      for (let i = 0; i < total; i++) {
        const t = await contract.getTransaction(id, i);
        // t[0] int delta; t[1] ts; t[2] note; t[3] by
        const delta = Number(t[0]);
        const ts = new Date(Number(t[1]) * 1000);
        list.push({ delta, ts, note: t[2], by: t[3] });
      }
      setTxns(list.reverse());
      setStatus("Loaded SIM data.");
    } catch (err) {
      console.error(err);
      setStatus(err?.error?.message || err?.message || String(err));
    }
  }

  // small helpers for UI conversions
  const dataMB = dataKB ? (Number(dataKB) / 1024).toFixed(2) : "-";
  const voiceMin = voiceSecs ? Math.floor(Number(voiceSecs) / 60) : "-";

  return (
    <div style={{ padding: 20, maxWidth: 1000, margin: "0 auto", fontFamily: "Arial, sans-serif" }}>
      <h2>📡 SimLedgerV2 — Telecom SIM Manager (testnet)</h2>
      <div style={{ marginBottom: 8, color: "#555" }}>
        Contract: <code>{CONTRACT_ADDRESS}</code>
      </div>

      {!account ? (
        <button onClick={connectWallet} style={{ padding: "8px 12px" }}>
          Connect MetaMask
        </button>
      ) : (
        <div style={{ marginBottom: 8 }}>
          <strong>Wallet:</strong> {account}
        </div>
      )}

      <div style={{ marginTop: 12, border: "1px solid #eee", padding: 12, borderRadius: 8 }}>
        <label>SIM ID (e.g. +919711556456)</label>
        <input
          value={simId}
          onChange={(e) => setSimId(e.target.value)}
          style={{ width: "100%", padding: 8, marginTop: 6, boxSizing: "border-box" }}
        />

        <div style={{ marginTop: 10 }}>
          <button onClick={() => loadSimData(simId)} style={{ marginRight: 8 }}>
            Load SIM
          </button>
          <button onClick={createSim} style={{ marginRight: 8 }}>
            Create SIM on-chain
          </button>
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <h4>Balances</h4>
            <div>Data: <strong>{dataMB} MB</strong> ({dataKB ? dataKB + " KB" : "-"})</div>
            <div>Voice: <strong>{voiceMin} min</strong> ({voiceSecs ? voiceSecs + " sec" : "-"})</div>
            <div>SMS: <strong>{smsCount ?? "-"}</strong></div>
          </div>

          <div style={{ flex: 1 }}>
            <h4>Top-up</h4>
            <div>
              <input placeholder="amount KB (e.g. 1024 = 1MB)" value={topUpDataAmount} onChange={(e) => setTopUpDataAmount(e.target.value)} style={{ width: "100%", padding: 6, marginBottom: 6 }} />
              <button onClick={topUpData} style={{ width: "100%", padding: 8 }}>Top-up Data</button>
            </div>

            <div style={{ marginTop: 8 }}>
              <input placeholder="amount secs (e.g. 600 = 10min)" value={topUpVoiceAmount} onChange={(e) => setTopUpVoiceAmount(e.target.value)} style={{ width: "100%", padding: 6, marginBottom: 6 }} />
              <button onClick={topUpVoice} style={{ width: "100%", padding: 8 }}>Top-up Voice</button>
            </div>

            <div style={{ marginTop: 8 }}>
              <input placeholder="amount SMS" value={topUpSmsAmount} onChange={(e) => setTopUpSmsAmount(e.target.value)} style={{ width: "100%", padding: 6, marginBottom: 6 }} />
              <button onClick={topUpSMS} style={{ width: "100%", padding: 8 }}>Top-up SMS</button>
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <h4>Consume / Use</h4>
            <div>
              <input placeholder="use KB (e.g. 100)" value={useDataAmount} onChange={(e) => setUseDataAmount(e.target.value)} style={{ width: "100%", padding: 6, marginBottom: 6 }} />
              <button onClick={useDataNow} style={{ width: "100%", padding: 8 }}>Use Data</button>
            </div>

            <div style={{ marginTop: 8 }}>
              <input placeholder="use secs (e.g. 60)" value={useVoiceAmount} onChange={(e) => setUseVoiceAmount(e.target.value)} style={{ width: "100%", padding: 6, marginBottom: 6 }} />
              <button onClick={useVoiceNow} style={{ width: "100%", padding: 8 }}>Use Voice</button>
            </div>

            <div style={{ marginTop: 8 }}>
              <input placeholder="use SMS (e.g. 1)" value={useSmsAmount} onChange={(e) => setUseSmsAmount(e.target.value)} style={{ width: "100%", padding: 6, marginBottom: 6 }} />
              <button onClick={useSMSNow} style={{ width: "100%", padding: 8 }}>Use SMS</button>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label>Note (optional)</label>
          <input value={noteInput} onChange={(e) => setNoteInput(e.target.value)} placeholder="transaction note" style={{ width: "100%", padding: 8, marginTop: 6 }} />
        </div>

        <div style={{ marginTop: 12 }}>
          <label>Transfer SIM to (address)</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={transferTo} onChange={(e) => setTransferTo(e.target.value)} placeholder="0x..." style={{ flex: 1, padding: 8 }} />
            <button onClick={transferSimNow} style={{ padding: "8px 12px" }}>Transfer</button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <h3>Transactions</h3>
        {txns.length === 0 ? (
          <p style={{ color: "#666" }}>No transactions yet.</p>
        ) : (
          txns.map((t, i) => (
            <div key={i} style={{ border: "1px solid #eee", padding: 10, marginBottom: 8, borderRadius: 6 }}>
              <div style={{ fontWeight: 600 }}>{t.note}</div>
              <div>Delta: {t.delta >= 0 ? "+" + t.delta : t.delta}</div>
              <div style={{ fontSize: 12, color: "#555" }}>By: {t.by}</div>
              <div style={{ fontSize: 12, color: "#888" }}>On: {t.ts.toLocaleString()}</div>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: 12, color: "#666" }}>{status}</div>
    </div>
  );
}
