# Flourian & Youstina RSVP (Toota Engagement)

Open `index.html` (or use Live Server) to test. To publish, upload the whole folder to any static host
(Netlify Drop, GitHub Pages, Cloudflare Pages). Keep the `images` folder next to `index.html`.
The page uses web-sized copies in `images/web/` (the original `bg.png` was 9 MB). Your originals are untouched.

## What happens after a guest replies
Once you finish the setup below, every reply (attending or not):

1. is added as a row in your Google Sheet (tab "RSVPs": time, name, status, email, message, thank-you email, ref),
2. is emailed to **youssef.mena2006@gmail.com**,
3. sends the guest a thank-you email, if they typed their email (the email field is optional). Each email address gets the thank-you once, even if the guest changes their answer later.

Until you paste the address in step 6, replies stay on the guest's own phone and nothing is sent.

## Setup (about 5 minutes, once)
A web page cannot save to a Sheet or send email by itself, so a small Google script does it.

1. Open Google Sheets and create a new blank sheet named "Wedding RSVPs". Use the Google account you want guests to see as the sender of the thank-you email. youssef.mena2006@gmail.com is a good choice, so replies to the thank-you also reach him.
2. In the sheet open **Extensions > Apps Script**. Delete the sample code, paste the whole content of `apps-script/Code.gs`, and click Save.
3. At the top choose the function **setup** and click **Run**. Google asks for permission to use Sheets and send email. Because this is your own script, Google shows "Google hasn't verified this app": click Advanced, then "Go to ... (unsafe)", then Allow.
4. Optional test: choose **sendTest** and click Run. An email titled "RSVP: TEST - delete this row ..." should arrive at youssef.mena2006@gmail.com (check Spam too). Delete the TEST row in the sheet afterwards.
5. Click **Deploy > New deployment**, choose the gear icon > **Web app**. Set "Execute as: Me" and "Who has access: Anyone". Click Deploy and copy the **Web app URL**.
6. In `index.html` find `const RSVP_ENDPOINT = "";` and paste the URL between the quotes. Upload the folder again.

If you change `Code.gs` later, use Deploy > Manage deployments > edit (pencil) > Version: New version > Deploy. Otherwise the old code keeps running.

## Good to know
- A free Gmail account can send about 100 emails per day. A reply uses up to 2 (one to you, one thank-you), so roughly 50 replies a day. If the limit is reached the reply is still saved in the sheet, and the "Thank-you email" column says "skipped".
- The "Thank-you email" column also tells you when a guest gave no email, when it was already sent, or when sending failed.
- If a guest has no signal, the reply waits on their phone and is sent the next time they open the page or go online.
- A guest who changes their answer adds a new row. Read the latest row for that name.
- Anyone who has the web app link could send it a reply, so keep the link inside the page and do not post it anywhere.

## Optional: WhatsApp button
In `index.html` find `WHATSAPP_NUMBER` and put your number with country code, digits only, for example `"201001234567"`.
The thank-you screen then shows a "Send my reply on WhatsApp" button with the message already written.
