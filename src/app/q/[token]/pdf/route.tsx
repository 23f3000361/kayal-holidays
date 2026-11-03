import { Document, Page, Text, View, StyleSheet, renderToBuffer, Font } from "@react-pdf/renderer";
import { getQuoteByToken } from "@/server/enquiries";

// Built-in Helvetica has no rupee glyph, so amounts use "Rs." in the PDF.
const rs = (n: number) => `Rs. ${new Intl.NumberFormat("en-IN").format(n)}`;
const d = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

Font.registerHyphenationCallback((w) => [w]);

const st = StyleSheet.create({
  page: { padding: 48, fontFamily: "Helvetica", fontSize: 10, color: "#1d211f", lineHeight: 1.45 },
  brand: { fontFamily: "Times-Roman", fontSize: 24, color: "#1d211f" },
  dot: { color: "#a8742a" },
  muted: { color: "#6b716c" },
  h1: { fontFamily: "Times-Roman", fontSize: 22, marginTop: 24 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: "#e6e1d8" },
  total: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10 },
  facts: { flexDirection: "row", marginTop: 16, gap: 24 },
  h2: { fontFamily: "Times-Roman", fontSize: 15, marginTop: 24, marginBottom: 6 },
  day: { flexDirection: "row", marginBottom: 6 },
  footer: { position: "absolute", bottom: 32, left: 48, right: 48, fontSize: 8, color: "#9aa09a" },
});

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[\w-]{16,64}$/.test(token)) return new Response("Not found", { status: 404 });
  const row = await getQuoteByToken(token);
  if (!row) return new Response("Not found", { status: 404 });
  const { q, e, v, by } = row;
  const c = v.content;

  const doc = (
    <Document title={`Quote ${q.ref}`} author="Kayal Holidays">
      <Page size="A4" style={st.page}>
        <Text style={st.brand}>Kayal<Text style={st.dot}>.</Text></Text>
        <Text style={st.muted}>Kayal Holidays, Kochi, Kerala</Text>
        <Text style={st.h1}>{c.title}</Text>
        <Text style={st.muted}>Quote {q.ref} for {e.name} · issued {d(q.createdAt.toISOString().slice(0, 10))} · valid until {d(q.validUntil)}</Text>
        <View style={st.facts}>
          <View><Text style={st.muted}>Start date</Text><Text>{d(q.travelDate)}</Text></View>
          <View><Text style={st.muted}>Length</Text><Text>{c.durationDays} days / {c.durationDays - 1} nights</Text></View>
          <View><Text style={st.muted}>Travellers</Text><Text>{q.adults} adults{q.children ? `, ${q.children} children` : ""}</Text></View>
          <View><Text style={st.muted}>Season</Text><Text>{q.price.season.name}, {q.price.season.hotelCategory}</Text></View>
        </View>
        <View style={{ marginTop: 20 }}>
          {q.price.lines.map((l) => (
            <View key={l.label} style={st.row}><Text>{l.label} ({l.qty} x {rs(l.unit)})</Text><Text>{rs(l.amount)}</Text></View>
          ))}
          <View style={st.row}><Text>GST {q.price.gstPercent}%</Text><Text>{rs(q.price.gst)}</Text></View>
          <View style={st.total}><Text style={{ fontFamily: "Helvetica-Bold" }}>Total</Text><Text style={{ fontFamily: "Helvetica-Bold", fontSize: 13 }}>{rs(q.price.total)}</Text></View>
          <Text style={st.muted}>Per person on twin sharing as shown. Subject to hotel availability when you book.</Text>
          {q.note ? <Text style={{ marginTop: 8 }}>{q.note}</Text> : null}
        </View>
        <Text style={st.h2}>Day by day</Text>
        {c.itinerary.map((day) => (
          <View key={day.day} style={st.day} wrap={false}>
            <Text style={{ width: 48, color: "#6b716c" }}>Day {day.day}</Text>
            <View style={{ flex: 1 }}><Text style={{ fontFamily: "Helvetica-Bold" }}>{day.title}</Text><Text>{day.description}</Text></View>
          </View>
        ))}
        <Text style={st.h2}>Included</Text>
        {c.inclusions.map((x) => <Text key={x}>• {x}</Text>)}
        <Text style={st.footer} fixed>Prepared by {by ?? "Kayal Holidays"} · Package {row.p.code} v{v.versionNo} · This is a quote, not a booking.</Text>
      </Page>
    </Document>
  );
  const buf = await renderToBuffer(doc);
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${q.ref}.pdf"`, "Cache-Control": "private, no-store" } });
}
