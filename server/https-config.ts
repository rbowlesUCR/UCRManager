import { readFileSync } from 'fs';
import { join } from 'path';

export async function getHttpsOptions() {
  try {
    const certDir = 'C:\\inetpub\\wwwroot\\UCRManager\\certificates';
    const domain = 'ucrmanager01.westus3.cloudapp.azure.com';

    // Read PEM files exported by Win-ACME
    const certPath = join(certDir, `${domain}-crt.pem`);
    const keyPath = join(certDir, `${domain}-key.pem`);
    const chainPath = join(certDir, `${domain}-chain-only.pem`);

    const cert = readFileSync(certPath, 'utf8');
    const key = readFileSync(keyPath, 'utf8');
    const ca = readFileSync(chainPath, 'utf8');

    return {
      cert,
      key,
      ca
    };

  } catch (error) {
    console.error('Error loading HTTPS certificate:', error);
    throw new Error('HTTPS configuration failed. Run with HTTP instead.');
  }
}
