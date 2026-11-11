import { createFlipbookClient } from "../../../public/sdk/v1/flipbook-server";
(async () => {
  const fb = createFlipbookClient({ apiKey: process.argv[2], baseUrl: "http://localhost:3000" });
  const page1 = await fb.listEvents({ limit: 2 });
  const all: number[] = [];
  for await (const { event, cursor } of fb.allEvents("0", 3)) { all.push(event.sequence); if (String(event.sequence) !== cursor) throw new Error("cursor mismatch"); }
  const docOnly = await fb.listEvents({ documentId: "sdk-doc" });
  const docStats = await fb.getDocumentStats("sdk-doc");
  console.log(JSON.stringify({ page1: page1.events.length, hasMore: page1.hasMore, all, docOnly: docOnly.events.every((e) => e.document.id === "sdk-doc") && docOnly.events.length > 0, docViews: docStats.totals.views, pages: docStats.pages.length }));
})().catch((e) => { console.error(e); process.exit(1); });
