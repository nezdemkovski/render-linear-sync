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
    const normalizedSecret = secret.startsWith("whsec_")
      ? secret.slice(6)
      : secret;

    const signedPayload = `${webhookId}.${webhookTimestamp}.${payload}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(normalizedSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(signedPayload)
    );

    let providedSignature = signature.trim();

    if (providedSignature.startsWith("v1,")) {
      providedSignature = providedSignature.slice(3);
    }

    const providedSignatureBytes = Uint8Array.from(
      atob(providedSignature.replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0)
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
        providedSignature: providedSignature.substring(0, 20) + "...",
        webhookId,
        webhookTimestamp,
      });
    }

    return isValid;
  } catch (error) {
    console.error("❌ Error verifying signature:", error);
    return false;
  }
};
