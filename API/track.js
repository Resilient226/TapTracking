export default async function handler(req, res) {
  const employee = req.query.utm_source || "unknown";  // same as utm_source
  const timestamp = new Date().toISOString();

  try {
    await fetch("https://script.google.com/macros/s/AKfycbzN4kO9YNPVxPWPmqHd9EXFX2q33RJR0p5LcLKS8LkFB7AibRqqDFRJl2MI6jULJkn4aw/exec", {
      method: "POST",
      body: JSON.stringify({ 
        employee,
        timestamp 
      }),
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("Tracking failed:", err);
  }

  res.redirect("https://LCSteak.info");
}
