
import inquirer from 'inquirer';
import qr from 'qr-image';
import fs from 'fs';
import path from 'path';
import terminalImage from 'terminal-image';

const TYPES = {
  URL:        "URL",
  PHONE:      "Phone number (tel:)",
  EMAIL:      "Email address (mailto:)",
  SMS:        "SMS message (sms:)",
  WIFI:       "WiFi network",
  TEXT:       "Plain text",
};

async function promptForData(type) {
  switch (type) {
    case TYPES.URL: {
      const { value } = await inquirer.prompt([{ message: "Enter URL:", name: "value" }]);
      return value.trim();
    }
    case TYPES.PHONE: {
      const { value } = await inquirer.prompt([{ message: "Enter phone number (e.g. +15551234567):", name: "value" }]);
      const num = value.trim();
      return num.startsWith("tel:") ? num : `tel:${num}`;
    }
    case TYPES.EMAIL: {
      const { value } = await inquirer.prompt([{ message: "Enter email address:", name: "value" }]);
      const addr = value.trim();
      return addr.startsWith("mailto:") ? addr : `mailto:${addr}`;
    }
    case TYPES.SMS: {
      const { phone, message } = await inquirer.prompt([
        { message: "Enter phone number (e.g. +15551234567):", name: "phone" },
        { message: "Enter message (optional):", name: "message", default: "" },
      ]);
      const body = message.trim();
      return body ? `smsto:${phone.trim()}:${body}` : `smsto:${phone.trim()}`;
    }
    case TYPES.WIFI: {
      const { ssid, password, security } = await inquirer.prompt([
        { message: "Network name (SSID):", name: "ssid" },
        { message: "Password (leave blank for open network):", name: "password", default: "" },
        {
          type: "list",
          message: "Security type:",
          name: "security",
          choices: ["WPA", "WEP", "nopass"],
          default: "WPA",
        },
      ]);
      return `WIFI:T:${security};S:${ssid.trim()};P:${password.trim()};;`;
    }
    case TYPES.TEXT: {
      const { value } = await inquirer.prompt([{ message: "Enter text:", name: "value" }]);
      return value.trim();
    }
  }
}

async function main() {
  const { type } = await inquirer.prompt([
    {
      type: "list",
      message: "What type of QR code would you like to generate?",
      name: "type",
      choices: Object.values(TYPES),
    },
  ]);

  const data = await promptForData(type);

  fs.mkdirSync("images", { recursive: true });

  const filename = `images/qr_${Date.now()}.png`;
  await new Promise((resolve, reject) => {
    const stream = qr.image(data);
    const out = fs.createWriteStream(filename);
    stream.pipe(out);
    out.on("finish", resolve);
    out.on("error", reject);
  });

  fs.writeFileSync("url_store.txt", data);
  const absolutePath = path.resolve(filename);
  console.log(`\nSaved: ${absolutePath}`);
  console.log(`Data:  ${data}\n`);

  try {
    const rendered = await terminalImage.file(filename, { width: "50%" });
    // Kitty protocol writes directly to stdout and returns an empty string
    if (typeof rendered === 'string' && rendered.length > 0) {
      console.log(rendered);
    } else if (rendered instanceof Promise) {
      // term-img fallback is async but not awaited internally — resolve it manually
      console.log(await rendered);
    }
  } catch (err) {
    console.log(`(Terminal image preview unavailable: ${err.message})`);
  }
}

main().catch((err) => {
  if (err?.isTtyError) {
    console.error("Prompt could not be rendered in this environment.");
  } else {
    console.error(err);
  }
});
