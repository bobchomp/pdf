import { createRoot } from "react-dom/client";
import { useState } from "react";
import { Flipbook, type FlipbookViewerEvent } from "../../../public/sdk/v1/flipbook-react";

declare global { interface Window { flipbookLog: FlipbookViewerEvent[] } }
window.flipbookLog = [];

function App() {
  const url = new URLSearchParams(location.search).get("src")!;
  const [page, setPage] = useState<number | null>(null);
  const [show, setShow] = useState(true);
  return (
    <div>
      <h1>React host</h1>
      <p id="page">{page === null ? "loading" : `page ${page}`}</p>
      <button id="toggle" onClick={() => setShow((s) => !s)}>toggle</button>
      {show && (
        <Flipbook
          url={url}
          height="600px"
          title="Spring newsletter"
          onReady={(e) => window.flipbookLog.push(e)}
          onPageChange={(e) => { window.flipbookLog.push(e); setPage(e.pageNumber!); }}
          onLinkClick={(e) => window.flipbookLog.push(e)}
        />
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
