const domain = "lanelogicjobs.com";
const apiKey = process.env.MAILGUN_API_KEY;

async function sendTest() {
  console.log("Checking connection to Mailgun...");

  const response = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa('api:' + apiKey),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      from: `System Check <postmaster@${domain}>`,
      to: 'YOUR_EMAIL@HERE.com', // <--- Put your email here!
      subject: 'LaneLogic: Infrastructure Verified',
      text: 'The API connection is active and DNS is correctly routed.'
    })
  });

  const result = await response.json();
  if (response.ok) {
    console.log("Success! Mailgun says:", result.message);
  } else {
    console.error("Error from Mailgun:", result);
  }
}

sendTest();