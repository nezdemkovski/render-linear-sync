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

    let keyBytes: Uint8Array;
    if (secret.startsWith("whsec_")) {
      try {
        const base64Secret = secret.slice(6);
        keyBytes = Uint8Array.from(
          atob(base64Secret.replace(/-/g, "+").replace(/_/g, "/")),
          (c) => c.charCodeAt(0)
        );
      } catch {
        keyBytes = encoder.encode(secret);
      }
    } else {
      keyBytes = encoder.encode(secret);
    }

    const signedString = `${webhookId}.${webhookTimestamp}.${payload}`;

    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(signedString)
    );

    const computedSignatureBytes = new Uint8Array(signatureBuffer);

    if (providedSignatureBytes.length !== computedSignatureBytes.length) {
      console.error("❌ Signature length mismatch:", {
        providedLength: providedSignatureBytes.length,
        computedLength: computedSignatureBytes.length,
      });
      return false;
    }

    let isValid = true;
    for (let i = 0; i < providedSignatureBytes.length; i++) {
      if (providedSignatureBytes[i] !== computedSignatureBytes[i]) {
        isValid = false;
        break;
      }
    }

    if (!isValid) {
      console.error("❌ Signature mismatch:", {
        providedSignaturePreview: providedSignature.substring(0, 50),
        computedSignatureBase64: btoa(
          String.fromCharCode(...computedSignatureBytes)
        ).substring(0, 50),
        webhookId,
        webhookTimestamp,
        signedStringLength: signedString.length,
      });
    }

    return isValid;

    return false;
  } catch (error) {
    console.error("❌ Error verifying signature:", error);
    return false;
  }
};
