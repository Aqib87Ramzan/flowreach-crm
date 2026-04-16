const url = "https://zlilmhljwccilffppalp.supabase.co/functions/v1/send-whatsapp";

async function run() {
  const payload = {
    phone: "03317608942",
    message: "Direct test from CLI to send-whatsapp",
    lead_id: "b0adc095-5552-441f-be87-291ef00e1b6f" // from hoppscotch screenshot
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response:", text);
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}
run();
