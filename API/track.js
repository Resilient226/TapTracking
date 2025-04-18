export default async function handler(req, res) {
  const utm = req.query.utm_source || "unknown";

  await fetch("https://script.google.com/macros/s/AKfycbzN4kO9YNPVxPWPmqHd9EXFX2q33RJR0p5LcLKS8LkFB7AibRqqDFRJl2MI6jULJkn4aw/exec", {
    method: "POST",
    body: JSON.stringify({ utm_source: utm }),
    headers: { "Content-Type": "application/json" }
  });

  res.redirect("https://LCSteak.info");
}
