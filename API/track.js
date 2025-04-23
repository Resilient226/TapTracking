export default async function handler(req, res) {
  const employee = req.query.utm_source || "unknown";
  const timestamp = new Date().toISOString();

  try {
    await fetch("https://script.google.com/macros/s/AKfycbyJJ97Oq4uIHaPoSjJt32bWSn_3691P0R3_PfwMlYMIB1kcdkvRDtlbyykvrT9yA62_Tw/exec", {
      method: "POST",
      body: JSON.stringify({ employee, timestamp }),
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("Tracking failed:", err);
  }

  res.redirect("https://LCSteak.info");
}
