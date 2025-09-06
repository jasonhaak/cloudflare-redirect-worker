import { Buffer } from 'buffer';

export function base64Decode(b64String) {
  return Buffer.from(b64String, 'base64').toString('utf8');
}

export function base64Encode(textString) {
  return Buffer.from(textString, 'utf8').toString('base64');
}
