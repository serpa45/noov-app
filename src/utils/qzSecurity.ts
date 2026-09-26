/**
 * QZ Tray Security & WebCrypto Signing
 * Responsável por prover o certificado digital e assinar as mensagens do QZ Tray
 * utilizando a API nativa WebCrypto do navegador, eliminando popups de aviso.
 */

export const DEFAULT_QZ_CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIIECzCCAvOgAwIBAgIGAZ+fcLlZMA0GCSqGSIb3DQEBCwUAMIGiMQswCQYDVQQG
EwJVUzELMAkGA1UECAwCTlkxEjAQBgNVBAcMCUNhbmFzdG90YTEbMBkGA1UECgwS
UVogSW5kdXN0cmllcywgTExDMRswGQYDVQQLDBJRWiBJbmR1c3RyaWVzLCBMTEMx
HDAaBgkqhkiG9w0BCQEWDXN1cHBvcnRAcXouaW8xGjAYBgNVBAMMEVFaIFRyYXkg
RGVtbyBDZXJ0MB4XDTI2MDcyNTE3MTk1MloXDTQ2MDcyNTE3MTk1MlowgaIxCzAJ
BgNVBAYTAlVTMQswCQYDVQQIDAJOWTESMBAGA1UEBwwJQ2FuYXN0b3RhMRswGQYD
VQQKDBJRWiBJbmR1c3RyaWVzLCBMTEMxGzAZBgNVBAsMElFaIEluZHVzdHJpZXMs
IExMQzEcMBoGCSqGSIb3DQEJARYNc3VwcG9ydEBxei5pbzEaMBgGA1UEAwwRUVog
VHJheSBEZW1vIENlcnQwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCs
cJwgu4DkJ1KNN1/EvJ3BcAFnLKLI69HQRE6sKBqZg7RCr8mG+PCM4RVrVGXD0/TQ
nvk+zrj00IV1+1zXd/450U3WdN7TFoZj3ZLlyGQhvenpYZFvH9EEPpKz5cwFrDhq
+J4BxHkNLNhXWlanzzG033mqTeaiEFerF/p2O3omx/sK/8HPIf6Jzr6B3nQJYRHv
WxD2HG2yaKLgTQHWw0UZM9o7BJSjYaw2Czxt27GqbgGrl+xenEYJaVmgBBxOKSMM
fEsF5B+Gkczhw6Xa//xnPpefoPoW7Ca0V2WP8JpoYLF4vDiDuBeEi8f24ru93d0h
h7cX3ZdzvUcvxWcG8MDJAgMBAAGjRTBDMBIGA1UdEwEB/wQIMAYBAf8CAQEwDgYD
VR0PAQH/BAQDAgEGMB0GA1UdDgQWBBQW7LuukigmBwqGIe/N4ib9vlZhmTANBgkq
hkiG9w0BAQsFAAOCAQEAnaQH7YiC01GP7OgpOZsDANlEzo5Tmi76kH97gkMv2BBC
wXBViYY5W0On2t55ApmC8QXd9fKTgjn5780D3E2G3YIzjD6l9py440pyyVHZ1BhU
rK7Ec+Fe9P9nC/d0bKQIckOuoyKB5mXrWgYFV0v7QwF4YBOuimfYJ5xAt1iHVfe5
XhOcLBFz2OoSMcaGCSCMHPeszlzsu//syeP4xilzhzuE56SfVZcSVNEiQSv0aG9o
RMyG9XVYat+qPWOCsXy9U9B2KcIoZzi61Ndl0/RAPvakgZc50u1+lhxyRNF/t5RM
AutgmSfNDp/QiOCf0w5AkxRbUe72DpVVb5hWLp+YJA==
-----END CERTIFICATE-----`;

export const DEFAULT_QZ_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCscJwgu4DkJ1KN
N1/EvJ3BcAFnLKLI69HQRE6sKBqZg7RCr8mG+PCM4RVrVGXD0/TQnvk+zrj00IV1
+1zXd/450U3WdN7TFoZj3ZLlyGQhvenpYZFvH9EEPpKz5cwFrDhq+J4BxHkNLNhX
WlanzzG033mqTeaiEFerF/p2O3omx/sK/8HPIf6Jzr6B3nQJYRHvWxD2HG2yaKLg
TQHWw0UZM9o7BJSjYaw2Czxt27GqbgGrl+xenEYJaVmgBBxOKSMMfEsF5B+Gkczh
w6Xa//xnPpefoPoW7Ca0V2WP8JpoYLF4vDiDuBeEi8f24ru93d0hh7cX3ZdzvUcv
xWcG8MDJAgMBAAECggEAEY9oqNErXaCPAKw7S4+5IXAgZnM2Uw9ntwWjvNabKdeu
iU15MG5kobYQrjTCpbvtjfqob1/SGDUtaB+8O0GAET96JZ0SbWzZa+1OFqoO31xF
iCOMUcSLzpq4Kgt8WLYKa0NM5Olu+dtfnxqnITDhcxXAYCpNcqLHKLhZBEYHiRAQ
2pPW3/ADnymk9KYE+fnnsqLZWjsTE/rCbY5a/CHXg1L98qwOn0Yw9DWedzilOOXU
VKjNbZaM486GO3ttoGwKJNHrxdvrvPQYCp3yiajzYqbt9X2yNoLPf+xM/d17B5PF
hWEAw8/yeI/3J1Ogufke7Ved1xoYmG3XYfg6AJ84oQKBgQDTkorAPz8bCl62UTTV
y4Kku3+mSy7LiC/cQ7Su69VohviIQmw8GZX+f0vLtyTB9SNodJf2vhe8qFizNRqq
dWOQMNBrFOlgURvL1ffRCV5mSswZqhmrOTS4FYt9KUZ91t2jVj/uuJlQ7LwukVFR
CD3FjZVcoRo69WTRQaUTf6ZQ6QKBgQDQpm1Yh4YKIeeP7MTZD1IOdJcRJ66806rO
DP0vohQdJqjrU7OBvKvFGOFo3a6+gv8hASOtcMMekg6U/jZJfCYTjmtskTvlJ6/l
miA+L4TYMbIDp+7SAEqCBBXGdPueLzdcSNB4WT1xLr6cy27EeCbvjCOZRb0Tyyf3
5C15iIAE4QKBgCqOKTZuAkVwGojVYKk4G/kCdbR/HtR1ehr1y1v7t5skusy9f4O/
Kbpc5GP/XHde1VZnTUGmDqQ1wFGbdteecP5Js0I2nJJw/gRL72KuXbx5gwAOhMc5
5G66dqogKTuagk4eRRHBM6VhWKCNPivsWnBoAAj3po0BWtv0Nj3ryQoxAoGAKDNY
sAz0i3E632UcDEJCahyWmqyNoz4ZE7g28/2DaJZxR14KIP4MDl6b14uWxogQxfgl
Op6WSYaUnqpYJVJxN6ViFznoU1+RKWjHu5OGQe1ZQhESF44MzP4if+k8LZ8lSHeT
Cw0OpIcAHM+pWNtZjR/wH/Dq3CxxV/azuE3PdKECgYEAk/z3OQ3lXS3ZkZhHIoKe
1WEBzVaCKxSedBicNwMkofOBsZqS9YeUpaQXNtJ+DhNifP008pPbYOD79FD59vOD
6Bz6ze7VKSwexwdYiJ+vj8juKB7/Q2+CDZcfAeZSxUlo5RZA3MXPrpNKMEHwXdYo
r9LO+mF7p/kB7PjBf3Y8yrY=
-----END PRIVATE KEY-----`;

/**
 * Assina uma string de desafio do QZ Tray usando a chave privada RSA e o algoritmo SHA-256
 */
export async function signWithWebCrypto(
  toSign: string, 
  privateKeyPem: string = DEFAULT_QZ_PRIVATE_KEY
): Promise<string> {
  const cleanKey = privateKeyPem
    .replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----/, '')
    .replace(/-----END (?:RSA )?PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');

  const binaryString = atob(cleanKey);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const cryptoObj = window.crypto || (window as any).msCrypto;
  if (!cryptoObj?.subtle) {
    throw new Error("WebCrypto não suportado pelo navegador.");
  }

  const privateKey = await cryptoObj.subtle.importKey(
    'pkcs8',
    bytes.buffer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  const encoder = new TextEncoder();
  const data = encoder.encode(toSign);
  const signatureBuffer = await cryptoObj.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    data
  );

  const signatureBytes = new Uint8Array(signatureBuffer);
  let binary = '';
  const len = signatureBytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(signatureBytes[i]);
  }

  return btoa(binary);
}
