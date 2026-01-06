export const verifyWebhookSignature = async (
  payload: string,
  signature: string | null,
  webhookId: string | null,
  webhookTimestamp: string | null,
  secret: string
): Promise<boolean> => {
  if (!signature || !secret || !webhookId || !webhookTimestamp) {
    console.error("❌ Missing signature components:", {
      hasSignature: !!signature,
      hasSecret: !!secret,
      hasWebhookId: !!webhookId,
      hasWebhookTimestamp: !!webhookTimestamp,
    });
    return false;
  }

  try {
    let providedSignature = signature.trim();
    const hasV1Prefix = providedSignature.startsWith("v1,");

    if (hasV1Prefix) {
      providedSignature = providedSignature.slice(3);
    }

    const signedPayload = `${webhookId}.${webhookTimestamp}.${payload}`;
    const encoder = new TextEncoder();

    let providedSignatureBytes: Uint8Array;
    try {
      providedSignatureBytes = Uint8Array.from(
        atob(providedSignature.replace(/-/g, "+").replace(/_/g, "/")),
        (c) => c.charCodeAt(0)
      );
    } catch (error) {
      console.error("❌ Error decoding provided signature:", error);
      return false;
    }

    const secretsToTry = secret.startsWith("whsec_")
      ? [secret, secret.slice(6)]
      : [`whsec_${secret}`, secret];

    for (let i = 0; i < secretsToTry.length; i++) {
      const testSecret = secretsToTry[i];
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(testSecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );

      const signatureBuffer = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(signedPayload)
      );

      const computedSignatureBytes = new Uint8Array(signatureBuffer);
      const computedSignatureBase64 = btoa(
        String.fromCharCode(...computedSignatureBytes)
      );

      if (providedSignatureBytes.length !== computedSignatureBytes.length) {
        console.log(
          `🔍 Attempt ${
            i + 1
          }: Length mismatch (secret has whsec_ prefix: ${testSecret.startsWith(
            "whsec_"
          )})`
        );
        continue;
      }

      let isValid = true;
      for (let j = 0; j < providedSignatureBytes.length; j++) {
        if (providedSignatureBytes[j] !== computedSignatureBytes[j]) {
          isValid = false;
          break;
        }
      }

      if (isValid) {
        console.log(
          `✅ Signature verified (using secret ${
            testSecret.startsWith("whsec_") ? "with" : "without"
          } whsec_ prefix)`
        );
        return true;
      } else {
        console.log(
          `🔍 Attempt ${
            i + 1
          }: Signature mismatch (secret has whsec_ prefix: ${testSecret.startsWith(
            "whsec_"
          )})`
        );
      }
    }

    console.error(
      "❌ Signature mismatch (tried both with and without whsec_ prefix):",
      {
        providedSignaturePreview: providedSignature.substring(0, 50),
        webhookId,
        webhookTimestamp,
        signedPayloadLength: signedPayload.length,
        payloadPreview: payload.substring(0, 100),
      }
    );

    return false;
  } catch (error) {
    console.error("❌ Error verifying signature:", error);
    return false;
  }
};
