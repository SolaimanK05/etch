import { useEffect, useRef, useState } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { health, scan } from "./api";
import type { ArchGraph } from "./types";

export default function App() {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);

  const [backendStatus, setBackendStatus] = useState<string>("checking…");
  const [repoPath, setRepoPath] = useState("demo-app");
  const [rootPackage, setRootPackage] = useState("shop");
  const [scanResult, setScanResult] = useState<ArchGraph | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    health()
      .then((h) => setBackendStatus(`ok v${h.version}`))
      .catch(() => setBackendStatus("offline"));
  }, []);

  function handleScan() {
    setScanResult(null);
    setScanError(null);
    scan({ repo_path: repoPath, root_package: rootPackage })
      .then((result) => setScanResult(result))
      .catch((err: unknown) =>
        setScanError(err instanceof Error ? err.message : String(err))
      );
  }

  return (
    <div style={{ display: "flex", flexDirection: "row", height: "100vh" }}>
      <div style={{ flex: 1, height: "100vh" }}>
        <Excalidraw excalidrawAPI={(api) => (apiRef.current = api)} />
      </div>

      <aside
        style={{
          width: 360,
          borderLeft: "1px solid #ccc",
          padding: 16,
          overflowY: "auto",
          boxSizing: "border-box",
        }}
      >
        <h1 style={{ margin: "0 0 4px" }}>Etch</h1>
        <p style={{ margin: "0 0 16px", color: "#666" }}>
          doodle-driven development
        </p>

        <p style={{ margin: "0 0 16px" }}>
          backend: {backendStatus}
        </p>

        <label style={{ display: "block", marginBottom: 8 }}>
          repo_path
          <br />
          <input
            value={repoPath}
            onChange={(e) => setRepoPath(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box" }}
          />
        </label>

        <label style={{ display: "block", marginBottom: 16 }}>
          root_package
          <br />
          <input
            value={rootPackage}
            onChange={(e) => setRootPackage(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box" }}
          />
        </label>

        <button onClick={handleScan}>Scan</button>

        {scanError && (
          <p style={{ color: "red", marginTop: 12 }}>{scanError}</p>
        )}
        {scanResult && (
          <pre style={{ marginTop: 12, fontSize: 12, overflowX: "auto" }}>
            {JSON.stringify(scanResult, null, 2)}
          </pre>
        )}
      </aside>
    </div>
  );
}
